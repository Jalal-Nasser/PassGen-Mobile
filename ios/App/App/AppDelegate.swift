
import UIKit
import SwiftUI
import CryptoKit
import CommonCrypto

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let viewModel = NativeVaultViewModel()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let rootView = NativeVaultRootView(viewModel: viewModel)
        let hostingController = UIHostingController(rootView: rootView)
        hostingController.view.backgroundColor = .systemBackground

        if let existingWindow = self.window {
            existingWindow.rootViewController = hostingController
            existingWindow.makeKeyAndVisible()
        } else {
            let newWindow = UIWindow(frame: UIScreen.main.bounds)
            newWindow.rootViewController = hostingController
            self.window = newWindow
            newWindow.makeKeyAndVisible()
        }

        return true
    }
}

private enum NativeTab: Hashable {
    case vault
    case generator
    case settings
}

private enum PremiumTier: String, CaseIterable, Hashable {
    case free
    case pro
    case cloud

    var title: String {
        switch self {
        case .free:
            return "FREE"
        case .pro:
            return "PRO"
        case .cloud:
            return "CLOUD"
        }
    }

    var subtitle: String {
        switch self {
        case .free:
            return "Up to 4 passwords"
        case .pro:
            return "Unlimited passwords"
        case .cloud:
            return "Unlimited + cloud tier"
        }
    }

    var priceLabel: String {
        switch self {
        case .free:
            return "$0"
        case .pro:
            return "$2.99/mo"
        case .cloud:
            return "$4.99/mo"
        }
    }
}

private struct OnboardingPage: Identifiable {
    let id: Int
    let title: String
    let subtitle: String
    let systemImage: String
}

private struct AlertState: Identifiable {
    let id = UUID()
    let message: String
}

private struct VaultEntry: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var username: String
    var password: String
    var url: String
    var notes: String
    var createdAt: Date
    var updatedAt: Date
}

private struct VaultEntryDraft {
    var id: String?
    var name: String
    var username: String
    var password: String
    var url: String
    var notes: String
    var createdAt: Date?

    static let empty = VaultEntryDraft(
        id: nil,
        name: "",
        username: "",
        password: "",
        url: "",
        notes: "",
        createdAt: nil
    )

    init(entry: VaultEntry) {
        self.id = entry.id
        self.name = entry.name
        self.username = entry.username
        self.password = entry.password
        self.url = entry.url
        self.notes = entry.notes
        self.createdAt = entry.createdAt
    }

    init(
        id: String?,
        name: String,
        username: String,
        password: String,
        url: String,
        notes: String,
        createdAt: Date?
    ) {
        self.id = id
        self.name = name
        self.username = username
        self.password = password
        self.url = url
        self.notes = notes
        self.createdAt = createdAt
    }

    func toEntry(now: Date) -> VaultEntry {
        VaultEntry(
            id: id ?? UUID().uuidString,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            username: username.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password,
            url: url.trimmingCharacters(in: .whitespacesAndNewlines),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: createdAt ?? now,
            updatedAt: now
        )
    }
}

private struct VaultPayload: Codable {
    var entries: [VaultEntry]
    var createdAt: Date
    var updatedAt: Date
}

private struct VaultFileHeader: Codable {
    var magic: String
    var version: Int
    var salt: String
    var iterations: Int
}

private struct VaultFile: Codable {
    var header: VaultFileHeader
    var nonce: String
    var tag: String
    var ciphertext: String
}

private enum VaultStoreError: LocalizedError {
    case passwordTooShort
    case invalidPassword
    case invalidVault
    case locked
    case encryptionFailure

    var errorDescription: String? {
        switch self {
        case .passwordTooShort:
            return "Master password must be at least 8 characters."
        case .invalidPassword:
            return "Incorrect master password."
        case .invalidVault:
            return "Vault data is invalid or corrupted."
        case .locked:
            return "Vault is locked."
        case .encryptionFailure:
            return "Unable to encrypt or decrypt vault data."
        }
    }
}

private final class NativeVaultStore {
    private static let vaultMagic = "PASSGEN-NATIVE-IOS"
    private static let vaultVersion = 1
    private static let keyLength = 32
    private static let iterations = 310_000

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let vaultURL: URL
    private var cachedHeader: VaultFileHeader?
    private var cachedPayload: VaultPayload?
    private var cachedKey: SymmetricKey?

    init() {
        let fileManager = FileManager.default
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = appSupport.appendingPathComponent("PassGenVault", isDirectory: true)
        if !fileManager.fileExists(atPath: folder.path) {
            try? fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        }
        self.vaultURL = folder.appendingPathComponent("passgen-vault.pgvault")
    }

    func hasVault() -> Bool {
        FileManager.default.fileExists(atPath: vaultURL.path)
    }

    func unlock(password: String) throws {
        guard password.count >= 8 else {
            throw VaultStoreError.passwordTooShort
        }

        if hasVault() {
            try unlockExistingVault(password: password)
        } else {
            try createNewVault(password: password)
        }
    }

    func listEntries() throws -> [VaultEntry] {
        guard let payload = cachedPayload else {
            throw VaultStoreError.locked
        }

        return payload.entries.sorted { lhs, rhs in
            lhs.updatedAt > rhs.updatedAt
        }
    }

    func upsert(entry: VaultEntry) throws {
        guard var payload = cachedPayload else {
            throw VaultStoreError.locked
        }

        if let index = payload.entries.firstIndex(where: { $0.id == entry.id }) {
            payload.entries[index] = entry
        } else {
            payload.entries.append(entry)
        }

        cachedPayload = payload
        try persist()
    }

    func delete(entryID: String) throws {
        guard var payload = cachedPayload else {
            throw VaultStoreError.locked
        }

        payload.entries.removeAll { $0.id == entryID }
        cachedPayload = payload
        try persist()
    }

    func lock() {
        cachedHeader = nil
        cachedPayload = nil
        cachedKey = nil
    }

    func reset() throws {
        lock()
        if hasVault() {
            try FileManager.default.removeItem(at: vaultURL)
        }
    }

    private func createNewVault(password: String) throws {
        let salt = try randomData(length: 16)
        let key = try deriveKey(password: password, salt: salt, iterations: Self.iterations)

        let header = VaultFileHeader(
            magic: Self.vaultMagic,
            version: Self.vaultVersion,
            salt: salt.base64EncodedString(),
            iterations: Self.iterations
        )

        let payload = VaultPayload(entries: [], createdAt: Date(), updatedAt: Date())

        cachedHeader = header
        cachedPayload = payload
        cachedKey = key

        try persist()
    }

    private func unlockExistingVault(password: String) throws {
        let data = try Data(contentsOf: vaultURL)
        let vaultFile: VaultFile

        do {
            vaultFile = try Self.decoder.decode(VaultFile.self, from: data)
        } catch {
            throw VaultStoreError.invalidVault
        }

        guard vaultFile.header.magic == Self.vaultMagic, vaultFile.header.version == Self.vaultVersion else {
            throw VaultStoreError.invalidVault
        }

        guard let salt = Data(base64Encoded: vaultFile.header.salt),
              let nonceData = Data(base64Encoded: vaultFile.nonce),
              let tagData = Data(base64Encoded: vaultFile.tag),
              let cipherData = Data(base64Encoded: vaultFile.ciphertext) else {
            throw VaultStoreError.invalidVault
        }

        let key = try deriveKey(password: password, salt: salt, iterations: vaultFile.header.iterations)

        do {
            let nonce = try AES.GCM.Nonce(data: nonceData)
            let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: cipherData, tag: tagData)
            let decrypted = try AES.GCM.open(box, using: key)
            let payload = try Self.decoder.decode(VaultPayload.self, from: decrypted)

            cachedHeader = vaultFile.header
            cachedPayload = payload
            cachedKey = key
        } catch {
            throw VaultStoreError.invalidPassword
        }
    }

    private func persist() throws {
        guard var payload = cachedPayload,
              let key = cachedKey,
              let header = cachedHeader else {
            throw VaultStoreError.locked
        }

        payload.updatedAt = Date()

        let plainData = try Self.encoder.encode(payload)

        do {
            let nonce = AES.GCM.Nonce()
            let sealed = try AES.GCM.seal(plainData, using: key, nonce: nonce)

            let vaultFile = VaultFile(
                header: header,
                nonce: Data(nonce).base64EncodedString(),
                tag: sealed.tag.base64EncodedString(),
                ciphertext: sealed.ciphertext.base64EncodedString()
            )

            let fileData = try Self.encoder.encode(vaultFile)
            try fileData.write(to: vaultURL, options: .atomic)
            cachedPayload = payload
        } catch {
            throw VaultStoreError.encryptionFailure
        }
    }

    private func deriveKey(password: String, salt: Data, iterations: Int) throws -> SymmetricKey {
        let passwordData = Data(password.utf8)
        var derived = Data(repeating: 0, count: Self.keyLength)

        let status = derived.withUnsafeMutableBytes { derivedBytes in
            passwordData.withUnsafeBytes { passwordBytes in
                salt.withUnsafeBytes { saltBytes in
                    guard let passwordBase = passwordBytes.bindMemory(to: Int8.self).baseAddress,
                          let saltBase = saltBytes.bindMemory(to: UInt8.self).baseAddress,
                          let derivedBase = derivedBytes.bindMemory(to: UInt8.self).baseAddress else {
                        return Int32(kCCParamError)
                    }

                    return CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBase,
                        passwordData.count,
                        saltBase,
                        salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedBase,
                        Self.keyLength
                    )
                }
            }
        }

        guard status == kCCSuccess else {
            throw VaultStoreError.encryptionFailure
        }

        return SymmetricKey(data: derived)
    }

    private func randomData(length: Int) throws -> Data {
        var data = Data(repeating: 0, count: length)
        let result = data.withUnsafeMutableBytes { pointer in
            guard let baseAddress = pointer.baseAddress else {
                return Int32(errSecParam)
            }
            return SecRandomCopyBytes(kSecRandomDefault, length, baseAddress)
        }

        guard result == errSecSuccess else {
            throw VaultStoreError.encryptionFailure
        }

        return data
    }
}

private final class NativeVaultViewModel: ObservableObject {
    @Published var isBooting = true
    @Published var showOnboarding = false
    @Published var onboardingIndex = 0
    @Published var hasVault = false
    @Published var isUnlocked = false
    @Published var masterPassword = ""
    @Published var showMasterPassword = false
    @Published var passwordHint = ""
    @Published var passwordHintInput = ""
    @Published var activeTab: NativeTab = .vault
    @Published var searchText = ""
    @Published var entries: [VaultEntry] = []
    @Published var alertState: AlertState?
    @Published var showEditorSheet = false
    @Published var draft = VaultEntryDraft.empty
    @Published var showResetPrompt = false
    @Published var showPlanSheet = false
    @Published var selectedTier: PremiumTier = .free

    @Published var generatedPassword = ""
    @Published var length = 18
    @Published var includeUppercase = true
    @Published var includeLowercase = true
    @Published var includeNumbers = true
    @Published var includeSymbols = true

    private let hintStorageKey = "passgen-password-hint"
    private let onboardingStorageKey = "passgen-onboarding-complete-native"
    private let planStorageKey = "passgen-plan-tier-native"
    private let store = NativeVaultStore()
    private let onboardingPagesData: [OnboardingPage] = [
        OnboardingPage(
            id: 0,
            title: "Secure Generator",
            subtitle: "Create strong passwords instantly with full control over length and symbols.",
            systemImage: "key.fill"
        ),
        OnboardingPage(
            id: 1,
            title: "Encrypted Vault",
            subtitle: "Store passwords in encrypted local storage protected by your master password.",
            systemImage: "lock.shield.fill"
        ),
        OnboardingPage(
            id: 2,
            title: "Plans",
            subtitle: "FREE includes 4 entries. PRO and CLOUD unlock unlimited vault entries.",
            systemImage: "crown.fill"
        )
    ]

    init() {
        bootstrap()
    }

    var onboardingPages: [OnboardingPage] {
        onboardingPagesData
    }

    var freePlanLimit: Int {
        4
    }

    var filteredEntries: [VaultEntry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return entries }

        return entries.filter { entry in
            [entry.name, entry.username, entry.url, entry.notes]
                .joined(separator: " ")
                .lowercased()
                .contains(query)
        }
    }

    func bootstrap() {
        hasVault = store.hasVault()
        passwordHint = UserDefaults.standard.string(forKey: hintStorageKey) ?? ""
        showOnboarding = !UserDefaults.standard.bool(forKey: onboardingStorageKey)
        if let storedTier = UserDefaults.standard.string(forKey: planStorageKey),
           let parsedTier = PremiumTier(rawValue: storedTier) {
            selectedTier = parsedTier
        } else {
            selectedTier = .free
        }
        generatedPassword = generatePassword()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.isBooting = false
        }
    }

    func nextOnboardingStep() {
        if onboardingIndex < onboardingPagesData.count - 1 {
            onboardingIndex += 1
        } else {
            completeOnboarding()
        }
    }

    func completeOnboarding() {
        showOnboarding = false
        onboardingIndex = 0
        UserDefaults.standard.set(true, forKey: onboardingStorageKey)
    }

    func setTier(_ tier: PremiumTier) {
        selectedTier = tier
        UserDefaults.standard.set(tier.rawValue, forKey: planStorageKey)
    }

    func unlockVault() {
        do {
            try store.unlock(password: masterPassword)

            if !hasVault {
                let normalizedHint = passwordHintInput.trimmingCharacters(in: .whitespacesAndNewlines)
                if !normalizedHint.isEmpty {
                    UserDefaults.standard.set(normalizedHint, forKey: hintStorageKey)
                    passwordHint = normalizedHint
                }
            }

            hasVault = true
            isUnlocked = true
            masterPassword = ""
            passwordHintInput = ""
            showMasterPassword = false
            refreshEntries()
        } catch {
            alertState = AlertState(message: (error as? LocalizedError)?.errorDescription ?? "Unable to unlock vault.")
        }
    }

    func lockVault() {
        store.lock()
        isUnlocked = false
        activeTab = .vault
        searchText = ""
        entries = []
        draft = .empty
        showEditorSheet = false
    }

    func refreshEntries() {
        do {
            entries = try store.listEntries()
        } catch {
            alertState = AlertState(message: "Unable to load vault entries.")
        }
    }

    func startCreateEntry(seedPassword: String? = nil) {
        if selectedTier == .free && entries.count >= freePlanLimit {
            alertState = AlertState(message: "Free plan allows up to 4 passwords. Upgrade to PRO for unlimited entries.")
            showPlanSheet = true
            return
        }
        draft = .empty
        if let seedPassword {
            draft.password = seedPassword
        }
        showEditorSheet = true
    }

    func startEditEntry(_ entry: VaultEntry) {
        draft = VaultEntryDraft(entry: entry)
        showEditorSheet = true
    }

    @discardableResult
    func saveDraftEntry() -> Bool {
        let entryName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !entryName.isEmpty else {
            alertState = AlertState(message: "Entry name is required.")
            return false
        }

        guard !draft.password.isEmpty else {
            alertState = AlertState(message: "Password is required.")
            return false
        }

        if draft.id == nil, selectedTier == .free, entries.count >= freePlanLimit {
            alertState = AlertState(message: "Free plan allows up to 4 passwords. Upgrade to PRO for unlimited entries.")
            showPlanSheet = true
            return false
        }

        do {
            let entry = draft.toEntry(now: Date())
            try store.upsert(entry: entry)
            refreshEntries()
            showEditorSheet = false
            draft = .empty
            return true
        } catch {
            alertState = AlertState(message: "Unable to save entry.")
            return false
        }
    }

    func deleteEntry(_ entry: VaultEntry) {
        do {
            try store.delete(entryID: entry.id)
            refreshEntries()
        } catch {
            alertState = AlertState(message: "Unable to delete entry.")
        }
    }

    func copyToClipboard(_ value: String, label: String) {
        UIPasteboard.general.string = value
        alertState = AlertState(message: "\(label) copied.")
    }

    func showComingSoon(_ feature: String) {
        alertState = AlertState(message: "\(feature) will be enabled in the next iOS update.")
    }

    func generatePassword() -> String {
        var pool = ""
        if includeLowercase { pool += "abcdefghijklmnopqrstuvwxyz" }
        if includeUppercase { pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ" }
        if includeNumbers { pool += "0123456789" }
        if includeSymbols { pool += "!@#$%^&*()_+-=[]{}|;:,.<>?" }

        guard !pool.isEmpty else {
            return ""
        }

        var output = ""
        for _ in 0 ..< max(8, min(64, length)) {
            let index = Int.random(in: 0 ..< pool.count)
            let character = pool[pool.index(pool.startIndex, offsetBy: index)]
            output.append(character)
        }
        return output
    }

    func regeneratePassword() {
        let value = generatePassword()
        if value.isEmpty {
            alertState = AlertState(message: "Enable at least one character type.")
            return
        }
        generatedPassword = value
    }

    func useGeneratedPasswordForNewEntry() {
        guard !generatedPassword.isEmpty else {
            alertState = AlertState(message: "Generate a password first.")
            return
        }

        activeTab = .vault
        startCreateEntry(seedPassword: generatedPassword)
    }

    func resetAppData() {
        do {
            try store.reset()
            UserDefaults.standard.removeObject(forKey: hintStorageKey)
            UserDefaults.standard.removeObject(forKey: onboardingStorageKey)
            UserDefaults.standard.removeObject(forKey: planStorageKey)

            hasVault = false
            isUnlocked = false
            showOnboarding = true
            onboardingIndex = 0
            passwordHint = ""
            passwordHintInput = ""
            masterPassword = ""
            searchText = ""
            entries = []
            draft = .empty
            showEditorSheet = false
            showPlanSheet = false
            activeTab = .vault
            selectedTier = .free
            generatedPassword = generatePassword()
        } catch {
            alertState = AlertState(message: "Unable to reset app data.")
        }
    }
}

private struct NativeVaultRootView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 102 / 255, green: 126 / 255, blue: 234 / 255),
                    Color(red: 118 / 255, green: 75 / 255, blue: 162 / 255)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if viewModel.isBooting {
                NativeSplashIntroView()
            } else if viewModel.showOnboarding {
                NativeOnboardingView(viewModel: viewModel)
            } else if !viewModel.isUnlocked {
                NativeUnlockView(viewModel: viewModel)
            } else {
                NativeMainTabView(viewModel: viewModel)
            }
        }
        .alert(item: $viewModel.alertState) { alert in
            Alert(title: Text("PassGen"), message: Text(alert.message), dismissButton: .default(Text("OK")))
        }
        .confirmationDialog(
            "Reset all local vault data?",
            isPresented: $viewModel.showResetPrompt,
            titleVisibility: .visible
        ) {
            Button("Reset", role: .destructive) {
                viewModel.resetAppData()
            }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(isPresented: $viewModel.showPlanSheet) {
            NativePlansView(viewModel: viewModel)
        }
    }
}

private struct NativeSplashIntroView: View {
    @State private var animateLogo = false

    var body: some View {
        VStack(spacing: 20) {
            NativeLogoView()
                .scaleEffect(animateLogo ? 1.0 : 0.86)
                .opacity(animateLogo ? 1.0 : 0.75)
                .animation(.easeInOut(duration: 0.8), value: animateLogo)

            Text("PassGen Vault")
                .font(.system(size: 30, weight: .bold))
                .foregroundColor(.white)

            Text("Loading secure workspace...")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color.white.opacity(0.9))

            ProgressView()
                .tint(.white)
                .padding(.top, 6)
        }
        .padding(.horizontal, 24)
        .onAppear {
            animateLogo = true
        }
    }
}

private struct NativeOnboardingView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Skip") {
                    viewModel.completeOnboarding()
                }
                .foregroundColor(.white.opacity(0.9))
                .font(.system(size: 15, weight: .semibold))
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)

            TabView(selection: $viewModel.onboardingIndex) {
                ForEach(viewModel.onboardingPages) { page in
                    VStack(spacing: 18) {
                        Image(systemName: page.systemImage)
                            .font(.system(size: 56, weight: .bold))
                            .foregroundColor(.white)
                            .padding(20)
                            .background(Color.white.opacity(0.16))
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                        Text(page.title)
                            .font(.system(size: 31, weight: .bold))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)

                        Text(page.subtitle)
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 26)
                    }
                    .tag(page.id)
                    .padding(.top, 50)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button(viewModel.onboardingIndex == viewModel.onboardingPages.count - 1 ? "Get Started" : "Continue") {
                viewModel.nextOnboardingStep()
            }
            .font(.system(size: 17, weight: .bold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.white)
            .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
            .cornerRadius(14)
            .padding(.horizontal, 22)
            .padding(.bottom, 30)
        }
    }
}

private struct NativePlansView: View {
    @ObservedObject var viewModel: NativeVaultViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            List {
                ForEach(PremiumTier.allCases, id: \.self) { tier in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(tier.title)
                                .font(.system(size: 16, weight: .bold))
                            Spacer()
                            Text(tier.priceLabel)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                        }

                        Text(tier.subtitle)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(.secondary)

                        Button(viewModel.selectedTier == tier ? "Current Plan" : "Select Plan") {
                            viewModel.setTier(tier)
                            dismiss()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(viewModel.selectedTier == tier)
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("Plans")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}

private struct NativeUnlockView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        VStack(spacing: 18) {
            NativeLogoView()

            Text("PassGen Vault")
                .font(.system(size: 30, weight: .bold))
                .foregroundColor(.white)

            Text(viewModel.hasVault ? "Unlock your local vault" : "Create your local vault")
                .foregroundColor(Color.white.opacity(0.9))

            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    Group {
                        if viewModel.showMasterPassword {
                            TextField("Master Password", text: $viewModel.masterPassword)
                        } else {
                            SecureField("Master Password", text: $viewModel.masterPassword)
                        }
                    }
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)

                    Button(viewModel.showMasterPassword ? "Hide" : "Show") {
                        viewModel.showMasterPassword.toggle()
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(red: 102 / 255, green: 126 / 255, blue: 234 / 255))
                }
                .padding(12)
                .background(Color.white)
                .cornerRadius(12)

                if !viewModel.hasVault {
                    TextField("Password hint (optional)", text: $viewModel.passwordHintInput)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .padding(12)
                        .background(Color.white)
                        .cornerRadius(12)
                } else if !viewModel.passwordHint.isEmpty {
                    Text("Hint: \(viewModel.passwordHint)")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color(red: 42 / 255, green: 49 / 255, blue: 92 / 255))
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white.opacity(0.92))
                        .cornerRadius(12)
                }

                Button(viewModel.hasVault ? "Unlock Vault" : "Create Vault") {
                    viewModel.unlockVault()
                }
                .font(.system(size: 17, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.white)
                .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                .cornerRadius(12)
            }
            .padding(18)
            .background(Color.white.opacity(0.2))
            .cornerRadius(20)
            .padding(.horizontal, 16)
        }
        .padding(.top, 24)
        .padding(.horizontal, 10)
    }
}

private struct NativeMainTabView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        TabView(selection: $viewModel.activeTab) {
            NativeVaultTabView(viewModel: viewModel)
                .tag(NativeTab.vault)
                .tabItem {
                    Label("Vault", systemImage: "lock.shield")
                }

            NativeGeneratorTabView(viewModel: viewModel)
                .tag(NativeTab.generator)
                .tabItem {
                    Label("Generator", systemImage: "key.fill")
                }

            NativeSettingsTabView(viewModel: viewModel)
                .tag(NativeTab.settings)
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .accentColor(Color(red: 102 / 255, green: 126 / 255, blue: 234 / 255))
    }
}

private struct NativeVaultTabView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        NavigationView {
            List {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Plan: \(viewModel.selectedTier.title)")
                                .font(.system(size: 13, weight: .semibold))
                            if viewModel.selectedTier == .free {
                                Text("\(viewModel.entries.count)/\(viewModel.freePlanLimit) passwords used")
                                    .font(.system(size: 12, weight: .regular))
                                    .foregroundColor(.secondary)
                            } else {
                                Text("Unlimited passwords enabled")
                                    .font(.system(size: 12, weight: .regular))
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        Button("Upgrade") {
                            viewModel.showPlanSheet = true
                        }
                        .font(.system(size: 13, weight: .bold))
                    }
                }

                if viewModel.filteredEntries.isEmpty {
                    Text("No entries yet. Tap + to add your first password.")
                        .foregroundColor(.secondary)
                }

                ForEach(viewModel.filteredEntries) { entry in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(entry.name)
                            .font(.system(size: 17, weight: .semibold))

                        if !entry.username.isEmpty {
                            Text(entry.username)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.secondary)
                        }

                        if !entry.url.isEmpty {
                            Text(entry.url)
                                .font(.system(size: 13, weight: .regular))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        viewModel.startEditEntry(entry)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            viewModel.copyToClipboard(entry.password, label: "Password")
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .tint(Color(red: 102 / 255, green: 126 / 255, blue: 234 / 255))

                        Button(role: .destructive) {
                            viewModel.deleteEntry(entry)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .background(Color.clear)
            .searchable(text: $viewModel.searchText, prompt: "Search Vault")
            .navigationTitle("Vault")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Lock") {
                        viewModel.lockVault()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.startCreateEntry()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
        .sheet(isPresented: $viewModel.showEditorSheet) {
            NativeEntryEditorView(viewModel: viewModel)
        }
    }
}

private struct NativeGeneratorTabView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        NavigationView {
            Form {
                Section("Generated Password") {
                    Text(viewModel.generatedPassword.isEmpty ? "Tap regenerate." : viewModel.generatedPassword)
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)

                    Button("Regenerate") {
                        viewModel.regeneratePassword()
                    }

                    Button("Copy Password") {
                        if viewModel.generatedPassword.isEmpty {
                            viewModel.alertState = AlertState(message: "Generate a password first.")
                        } else {
                            viewModel.copyToClipboard(viewModel.generatedPassword, label: "Password")
                        }
                    }

                    Button("Use In New Vault Entry") {
                        viewModel.useGeneratedPasswordForNewEntry()
                    }
                }

                Section("Options") {
                    Stepper("Length: \(viewModel.length)", value: $viewModel.length, in: 8 ... 64)
                    Toggle("Uppercase", isOn: $viewModel.includeUppercase)
                    Toggle("Lowercase", isOn: $viewModel.includeLowercase)
                    Toggle("Numbers", isOn: $viewModel.includeNumbers)
                    Toggle("Symbols", isOn: $viewModel.includeSymbols)
                }
            }
            .navigationTitle("Generator")
        }
        .navigationViewStyle(.stack)
        .onChange(of: viewModel.length) { _ in
            viewModel.regeneratePassword()
        }
        .onChange(of: viewModel.includeUppercase) { _ in
            viewModel.regeneratePassword()
        }
        .onChange(of: viewModel.includeLowercase) { _ in
            viewModel.regeneratePassword()
        }
        .onChange(of: viewModel.includeNumbers) { _ in
            viewModel.regeneratePassword()
        }
        .onChange(of: viewModel.includeSymbols) { _ in
            viewModel.regeneratePassword()
        }
    }
}

private struct NativeSettingsTabView: View {
    @ObservedObject var viewModel: NativeVaultViewModel

    var body: some View {
        NavigationView {
            Form {
                Section("Subscription") {
                    HStack {
                        Text("Current Plan")
                        Spacer()
                        Text(viewModel.selectedTier.title)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                    }

                    Button("Manage Plans") {
                        viewModel.showPlanSheet = true
                    }
                }

                Section("Authentication") {
                    Button("Sign in with Apple") {
                        viewModel.showComingSoon("Sign in with Apple")
                    }

                    Button("Sign in with Google") {
                        viewModel.showComingSoon("Sign in with Google")
                    }
                }

                Section("Security") {
                    Button("Lock Vault") {
                        viewModel.lockVault()
                    }

                    Button("Reset Local App", role: .destructive) {
                        viewModel.showResetPrompt = true
                    }
                }
            }
            .navigationTitle("Settings")
        }
        .navigationViewStyle(.stack)
    }
}

private struct NativeEntryEditorView: View {
    @ObservedObject var viewModel: NativeVaultViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section("Entry") {
                    TextField("Name", text: $viewModel.draft.name)
                    TextField("Username", text: $viewModel.draft.username)

                    SecureField("Password", text: $viewModel.draft.password)

                    Button("Generate Password") {
                        viewModel.draft.password = viewModel.generatePassword()
                    }

                    TextField("URL", text: $viewModel.draft.url)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)

                    TextEditor(text: $viewModel.draft.notes)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle(viewModel.draft.id == nil ? "New Entry" : "Edit Entry")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        if viewModel.saveDraftEntry() {
                            dismiss()
                        }
                    }
                    .font(.system(size: 17, weight: .bold))
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}

private struct NativeLogoView: View {
    var body: some View {
        Group {
            if let image = loadLogoImage() {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "lock.shield.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                    .padding(18)
                    .background(Color.white)
            }
        }
        .frame(width: 86, height: 86)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(0.18), radius: 14, x: 0, y: 10)
    }

    private func loadLogoImage() -> UIImage? {
        if let direct = UIImage(named: "icon") {
            return direct
        }

        if let resourceURL = Bundle.main.url(forResource: "icon", withExtension: "png", subdirectory: "public"),
           let imageData = try? Data(contentsOf: resourceURL),
           let image = UIImage(data: imageData) {
            return image
        }

        return nil
    }
}
