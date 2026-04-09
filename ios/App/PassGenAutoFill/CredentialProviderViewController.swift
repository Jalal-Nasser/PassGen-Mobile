import UIKit
import AuthenticationServices
import CryptoKit
import CommonCrypto
import LocalAuthentication

private enum PassGenAutoFillConfig {
    static let appGroupIdentifier = "group.com.mdeploy.passgen"
    static let vaultFolderName = "PassGenVault"
    static let vaultFileName = "passgen-vault.pgvault"
    static let keychainAccessGroup = "R9HFGYCSV2.com.mdeploy.passgen.shared"
    static let keychainService = "com.passgen.native.ios"
    static let keychainAccount = "vault-master-password"
}

private struct AutoFillVaultEntry: Codable, Hashable {
    let id: String
    let name: String
    let username: String
    let password: String
    let url: String
    let notes: String
    let websitePresetId: String?
    let websiteDomain: String?
    let websiteDescription: String?
    let totpSecret: String?
    let totpIssuer: String?
    let totpAccountName: String?
    let totpDigits: Int?
    let totpPeriod: Int?
    let totpAlgorithm: String?
    let createdAt: Date
    let updatedAt: Date
}

private struct AutoFillVaultPayload: Codable {
    let entries: [AutoFillVaultEntry]
    let createdAt: Date
    let updatedAt: Date
}

private struct AutoFillVaultFileHeader: Codable {
    let magic: String
    let version: Int
    let salt: String
    let iterations: Int
}

private struct AutoFillVaultFile: Codable {
    let header: AutoFillVaultFileHeader
    let nonce: String
    let tag: String
    let ciphertext: String
}

private enum AutoFillVaultError: LocalizedError {
    case appGroupUnavailable
    case vaultMissing
    case passwordTooShort
    case invalidPassword
    case invalidVault
    case encryptionFailure
    case biometricUnavailable(String)
    case biometricSecretMissing
    case biometricVerificationFailed

    var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "PassGen AutoFill is not configured correctly yet. Enable the App Group capability and reinstall the app."
        case .vaultMissing:
            return "No vault was found. Create and unlock your vault in PassGen first."
        case .passwordTooShort:
            return "Enter your master password to unlock PassGen AutoFill."
        case .invalidPassword:
            return "Incorrect master password."
        case .invalidVault:
            return "Your vault data is invalid or corrupted."
        case .encryptionFailure:
            return "Unable to decrypt your vault."
        case .biometricUnavailable(let reason):
            return "Biometric unlock is unavailable: \(reason)"
        case .biometricSecretMissing:
            return "Open PassGen, enable biometric unlock, and unlock your vault once before using AutoFill."
        case .biometricVerificationFailed:
            return "Biometric verification failed."
        }
    }
}

private enum SharedMasterPasswordKeychain {
    static func readWithBiometrics(prompt: String, completion: @escaping (Result<String, AutoFillVaultError>) -> Void) {
        let context = LAContext()
        context.localizedFallbackTitle = ""
        context.localizedCancelTitle = "Use Master Password"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            let reason = error?.localizedDescription ?? "Biometric authentication is not available on this device."
            completion(.failure(.biometricUnavailable(reason)))
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: prompt) { success, _ in
            guard success else {
                completion(.failure(.biometricVerificationFailed))
                return
            }

            context.interactionNotAllowed = true

            var item: CFTypeRef?
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: PassGenAutoFillConfig.keychainService,
                kSecAttrAccount as String: PassGenAutoFillConfig.keychainAccount,
                kSecAttrAccessGroup as String: PassGenAutoFillConfig.keychainAccessGroup,
                kSecReturnData as String: true,
                kSecUseAuthenticationContext as String: context
            ]

            let status = SecItemCopyMatching(query as CFDictionary, &item)
            guard status == errSecSuccess,
                  let data = item as? Data,
                  let password = String(data: data, encoding: .utf8),
                  !password.isEmpty else {
                completion(.failure(.biometricSecretMissing))
                return
            }

            completion(.success(password))
        }
    }
}

private final class AutoFillVaultStore {
    private static let vaultMagic = "PASSGEN-NATIVE-IOS"
    private static let vaultVersion = 1
    private static let keyLength = 32

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let vaultURL: URL

    init() throws {
        let fileManager = FileManager.default
        guard let container = fileManager.containerURL(forSecurityApplicationGroupIdentifier: PassGenAutoFillConfig.appGroupIdentifier) else {
            throw AutoFillVaultError.appGroupUnavailable
        }

        let folder = container.appendingPathComponent(PassGenAutoFillConfig.vaultFolderName, isDirectory: true)
        if !fileManager.fileExists(atPath: folder.path) {
            try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        }
        self.vaultURL = folder.appendingPathComponent(PassGenAutoFillConfig.vaultFileName)
    }

    func unlock(password: String) throws -> [AutoFillVaultEntry] {
        guard password.count >= 8 else {
            throw AutoFillVaultError.passwordTooShort
        }

        guard FileManager.default.fileExists(atPath: vaultURL.path) else {
            throw AutoFillVaultError.vaultMissing
        }

        let data = try Data(contentsOf: vaultURL)
        let vaultFile: AutoFillVaultFile
        do {
            vaultFile = try Self.decoder.decode(AutoFillVaultFile.self, from: data)
        } catch {
            throw AutoFillVaultError.invalidVault
        }

        guard vaultFile.header.magic == Self.vaultMagic,
              vaultFile.header.version == Self.vaultVersion,
              let salt = Data(base64Encoded: vaultFile.header.salt),
              let nonceData = Data(base64Encoded: vaultFile.nonce),
              let tagData = Data(base64Encoded: vaultFile.tag),
              let cipherData = Data(base64Encoded: vaultFile.ciphertext) else {
            throw AutoFillVaultError.invalidVault
        }

        let key = try deriveKey(password: password, salt: salt, iterations: vaultFile.header.iterations)

        do {
            let nonce = try AES.GCM.Nonce(data: nonceData)
            let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: cipherData, tag: tagData)
            let decrypted = try AES.GCM.open(box, using: key)
            let payload = try Self.decoder.decode(AutoFillVaultPayload.self, from: decrypted)
            return payload.entries
        } catch {
            throw AutoFillVaultError.invalidPassword
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
            throw AutoFillVaultError.encryptionFailure
        }

        return SymmetricKey(data: derived)
    }
}

final class CredentialProviderViewController: ASCredentialProviderViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate, UITextFieldDelegate {
    private let vaultStore: AutoFillVaultStore? = try? AutoFillVaultStore()
    private let statusLabel = UILabel(frame: .zero)
    private let passwordField = UITextField(frame: .zero)
    private let biometricButton = UIButton(type: .system)
    private let unlockButton = UIButton(type: .system)
    private let searchBar = UISearchBar(frame: .zero)
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private var tableHeightConstraint: NSLayoutConstraint?

    private var allEntries: [AutoFillVaultEntry] = []
    private var visibleEntries: [AutoFillVaultEntry] = []
    private var requestedServiceIdentifiers: [ASCredentialServiceIdentifier] = []
    private var requestedRecordIdentifier: String?
    private var isUnlocked = false
    private var hasAttemptedAutomaticUnlock = false

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        applyFilter()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        attemptAutomaticBiometricUnlockIfNeeded()
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        requestedServiceIdentifiers = serviceIdentifiers
        requestedRecordIdentifier = nil
        hasAttemptedAutomaticUnlock = false
        applyFilter()
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        requestedServiceIdentifiers = [credentialIdentity.serviceIdentifier]
        requestedRecordIdentifier = credentialIdentity.recordIdentifier
        hasAttemptedAutomaticUnlock = false
        applyFilter()
    }

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.Code.userInteractionRequired.rawValue
        ))
    }

    override func prepareInterfaceForExtensionConfiguration() {
        statusLabel.text = "Enable PassGen AutoFill in Settings > Passwords > Password Options after installing this build."
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "PassGen AutoFill"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.numberOfLines = 0
        statusLabel.font = .systemFont(ofSize: 14, weight: .regular)
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = vaultStore == nil
            ? AutoFillVaultError.appGroupUnavailable.localizedDescription
            : "Unlock PassGen to fill the matching credential."

        passwordField.translatesAutoresizingMaskIntoConstraints = false
        passwordField.placeholder = "Master Password"
        passwordField.isSecureTextEntry = true
        passwordField.borderStyle = .roundedRect
        passwordField.textContentType = .password
        passwordField.returnKeyType = .go
        passwordField.delegate = self
        passwordField.autocapitalizationType = .none
        passwordField.autocorrectionType = .no
        passwordField.clearButtonMode = .whileEditing

        biometricButton.translatesAutoresizingMaskIntoConstraints = false
        biometricButton.setTitle("Unlock with Face ID / Touch ID", for: .normal)
        biometricButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        biometricButton.backgroundColor = .secondarySystemBackground
        biometricButton.tintColor = .label
        biometricButton.layer.cornerRadius = 12
        biometricButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        biometricButton.addTarget(self, action: #selector(biometricTapped), for: .touchUpInside)

        unlockButton.translatesAutoresizingMaskIntoConstraints = false
        unlockButton.setTitle("Unlock Vault", for: .normal)
        unlockButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        unlockButton.backgroundColor = .systemBlue
        unlockButton.tintColor = .white
        unlockButton.layer.cornerRadius = 12
        unlockButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        unlockButton.addTarget(self, action: #selector(unlockTapped), for: .touchUpInside)

        searchBar.translatesAutoresizingMaskIntoConstraints = false
        searchBar.placeholder = "Search credentials"
        searchBar.autocapitalizationType = .none
        searchBar.delegate = self
        searchBar.isHidden = true

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.keyboardDismissMode = .onDrag
        tableView.rowHeight = 60
        tableView.tableFooterView = UIView(frame: .zero)
        tableView.isHidden = true

        view.addSubview(statusLabel)
        view.addSubview(passwordField)
        view.addSubview(biometricButton)
        view.addSubview(unlockButton)
        view.addSubview(searchBar)
        view.addSubview(tableView)

        tableHeightConstraint = tableView.heightAnchor.constraint(equalToConstant: 0)
        tableHeightConstraint?.isActive = true

        NSLayoutConstraint.activate([
            statusLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            passwordField.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 14),
            passwordField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            passwordField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            passwordField.heightAnchor.constraint(equalToConstant: 52),

            biometricButton.topAnchor.constraint(equalTo: passwordField.bottomAnchor, constant: 12),
            biometricButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            biometricButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            biometricButton.heightAnchor.constraint(equalToConstant: 52),

            unlockButton.topAnchor.constraint(equalTo: biometricButton.bottomAnchor, constant: 12),
            unlockButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            unlockButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            unlockButton.heightAnchor.constraint(equalToConstant: 52),

            searchBar.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),

            tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        updateVisibleState()
    }

    @objc private func cancelTapped() {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.Code.userCanceled.rawValue
        ))
    }

    @objc private func unlockTapped() {
        unlockVaultAndRefresh()
    }

    @objc private func biometricTapped() {
        unlockWithBiometrics()
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        unlockVaultAndRefresh()
        return true
    }

    private func unlockVaultAndRefresh() {
        guard let vaultStore else {
            statusLabel.text = AutoFillVaultError.appGroupUnavailable.localizedDescription
            return
        }

        do {
            let unlockedEntries = try vaultStore.unlock(password: passwordField.text ?? "")
            passwordField.resignFirstResponder()
            applyUnlockedEntries(unlockedEntries, preferDirectFill: true)
        } catch {
            statusLabel.text = (error as? LocalizedError)?.errorDescription ?? "Unable to unlock PassGen AutoFill."
        }
    }

    private func unlockWithBiometrics() {
        SharedMasterPasswordKeychain.readWithBiometrics(prompt: "Unlock PassGen AutoFill") { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                guard let vaultStore = self.vaultStore else {
                    self.statusLabel.text = AutoFillVaultError.appGroupUnavailable.localizedDescription
                    return
                }

                switch result {
                case .success(let password):
                    do {
                        let unlockedEntries = try vaultStore.unlock(password: password)
                        self.applyUnlockedEntries(unlockedEntries, preferDirectFill: true)
                    } catch {
                        self.statusLabel.text = (error as? LocalizedError)?.errorDescription ?? "Unable to unlock PassGen AutoFill."
                    }
                case .failure(let error):
                    self.statusLabel.text = error.localizedDescription
                }
            }
        }
    }

    private func attemptAutomaticBiometricUnlockIfNeeded() {
        guard !hasAttemptedAutomaticUnlock else { return }
        guard requestedRecordIdentifier != nil || !requestedServiceIdentifiers.isEmpty else { return }
        hasAttemptedAutomaticUnlock = true
        unlockWithBiometrics()
    }

    private func applyUnlockedEntries(_ unlockedEntries: [AutoFillVaultEntry], preferDirectFill: Bool) {
        allEntries = unlockedEntries.filter {
            !$0.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.password.isEmpty
        }
        isUnlocked = true
        updateVisibleState()

        guard !allEntries.isEmpty else {
            statusLabel.text = "No saved usernames and passwords are available for AutoFill yet."
            applyFilter()
            return
        }

        if preferDirectFill, let preferredEntry = resolvePreferredEntry(from: allEntries) {
            complete(with: preferredEntry)
            return
        }

        statusLabel.text = "Select the credential you want to fill."
        applyFilter()
    }

    private func updateVisibleState() {
        let isLocked = !isUnlocked
        passwordField.isHidden = !isLocked
        biometricButton.isHidden = !isLocked
        unlockButton.isHidden = !isLocked
        searchBar.isHidden = isLocked
        tableView.isHidden = isLocked
        tableHeightConstraint?.constant = isLocked ? 0 : 420
    }

    private func applyFilter() {
        guard isUnlocked else {
            visibleEntries = []
            tableView.reloadData()
            return
        }

        let query = searchBar.text?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let requestedDomains = requestedServiceDomains()

        visibleEntries = allEntries.filter { entry in
            let matchesDomain = requestedDomains.isEmpty || requestedDomains.contains { domain in
                entryMatches(entry, requestedDomain: domain)
            }

            let matchesQuery: Bool
            if query.isEmpty {
                matchesQuery = true
            } else {
                let haystack = [
                    entry.name,
                    entry.username,
                    entry.url,
                    entry.websiteDomain ?? "",
                    entry.websiteDescription ?? ""
                ]
                .joined(separator: " ")
                .lowercased()
                matchesQuery = haystack.contains(query)
            }

            return matchesDomain && matchesQuery
        }
        .sorted { lhs, rhs in
            lhs.updatedAt > rhs.updatedAt
        }

        tableView.reloadData()
    }

    private func resolvePreferredEntry(from entries: [AutoFillVaultEntry]) -> AutoFillVaultEntry? {
        if let requestedRecordIdentifier,
           let exact = entries.first(where: { $0.id == requestedRecordIdentifier }) {
            return exact
        }

        let requestedDomains = requestedServiceDomains()
        guard !requestedDomains.isEmpty else { return nil }

        let matches = entries.filter { entry in
            requestedDomains.contains { domain in
                entryMatches(entry, requestedDomain: domain)
            }
        }

        if matches.count == 1 {
            return matches[0]
        }

        return nil
    }

    private func requestedServiceDomains() -> [String] {
        requestedServiceIdentifiers.compactMap { service in
            switch service.type {
            case .domain:
                return normalizeDomain(service.identifier)
            case .URL:
                return normalizeDomain(service.identifier)
            @unknown default:
                return normalizeDomain(service.identifier)
            }
        }
    }

    private func entryMatches(_ entry: AutoFillVaultEntry, requestedDomain: String) -> Bool {
        let candidates = [
            entry.websiteDomain,
            normalizeDomain(entry.url),
            normalizeDomain(entry.name)
        ]
        return candidates.compactMap { $0 }.contains { candidate in
            candidate == requestedDomain
                || candidate.hasSuffix("." + requestedDomain)
                || requestedDomain.hasSuffix("." + candidate)
        }
    }

    private func normalizeDomain(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let directURL = URL(string: trimmed), let host = directURL.host {
            return host.replacingOccurrences(of: "www.", with: "")
        }

        if let prefixed = URL(string: "https://\(trimmed)"), let host = prefixed.host {
            return host.replacingOccurrences(of: "www.", with: "")
        }

        return trimmed.replacingOccurrences(of: "www.", with: "")
    }

    private func complete(with entry: AutoFillVaultEntry) {
        let credential = ASPasswordCredential(user: entry.username, password: entry.password)
        extensionContext.completeRequest(withSelectedCredential: credential, completionHandler: nil)
    }

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        applyFilter()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        visibleEntries.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let reuseIdentifier = "credential-cell"
        let cell = tableView.dequeueReusableCell(withIdentifier: reuseIdentifier)
            ?? UITableViewCell(style: .subtitle, reuseIdentifier: reuseIdentifier)

        let entry = visibleEntries[indexPath.row]
        cell.textLabel?.text = entry.name.isEmpty ? entry.username : entry.name
        let subtitleParts = [
            entry.username,
            entry.websiteDomain ?? normalizeDomain(entry.url) ?? ""
        ]
        .filter { !$0.isEmpty }
        cell.detailTextLabel?.text = subtitleParts.joined(separator: " • ")
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        complete(with: visibleEntries[indexPath.row])
    }
}
