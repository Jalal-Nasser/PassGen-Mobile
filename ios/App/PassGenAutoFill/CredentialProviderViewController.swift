import UIKit
import AuthenticationServices
import CryptoKit
import CommonCrypto

private enum PassGenAutoFillConfig {
    static let appGroupIdentifier = "group.com.mdeploy.passgen"
    static let vaultFolderName = "PassGenVault"
    static let vaultFileName = "passgen-vault.pgvault"
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
    private let passwordField = UITextField(frame: .zero)
    private let unlockButton = UIButton(type: .system)
    private let statusLabel = UILabel(frame: .zero)
    private let searchBar = UISearchBar(frame: .zero)
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)

    private var allEntries: [AutoFillVaultEntry] = []
    private var visibleEntries: [AutoFillVaultEntry] = []
    private var requestedServiceIdentifiers: [ASCredentialServiceIdentifier] = []
    private var requestedRecordIdentifier: String?
    private var isUnlocked = false

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        applyFilter()
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        requestedServiceIdentifiers = serviceIdentifiers
        requestedRecordIdentifier = nil
        applyFilter()
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        requestedServiceIdentifiers = [credentialIdentity.serviceIdentifier]
        requestedRecordIdentifier = credentialIdentity.recordIdentifier
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
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancelTapped))

        passwordField.translatesAutoresizingMaskIntoConstraints = false
        passwordField.placeholder = "Master Password"
        passwordField.isSecureTextEntry = true
        passwordField.borderStyle = .roundedRect
        passwordField.textContentType = .password
        passwordField.delegate = self
        passwordField.returnKeyType = .go

        unlockButton.translatesAutoresizingMaskIntoConstraints = false
        unlockButton.setTitle("Unlock Vault", for: .normal)
        unlockButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        unlockButton.backgroundColor = .systemBlue
        unlockButton.tintColor = .white
        unlockButton.layer.cornerRadius = 12
        unlockButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        unlockButton.addTarget(self, action: #selector(unlockTapped), for: .touchUpInside)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.numberOfLines = 0
        statusLabel.font = .systemFont(ofSize: 14, weight: .regular)
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = vaultStore == nil
            ? AutoFillVaultError.appGroupUnavailable.localizedDescription
            : "Unlock PassGen with your master password to autofill credentials."

        searchBar.translatesAutoresizingMaskIntoConstraints = false
        searchBar.placeholder = "Search credentials"
        searchBar.autocapitalizationType = .none
        searchBar.delegate = self
        searchBar.isHidden = true

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.isHidden = true
        tableView.keyboardDismissMode = .onDrag

        let stack = UIStackView(arrangedSubviews: [passwordField, unlockButton, statusLabel, searchBar, tableView])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16),
            tableView.heightAnchor.constraint(greaterThanOrEqualToConstant: 260)
        ])
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
            allEntries = unlockedEntries.filter { !$0.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.password.isEmpty }
            isUnlocked = true
            searchBar.isHidden = false
            tableView.isHidden = false
            passwordField.resignFirstResponder()

            if allEntries.isEmpty {
                statusLabel.text = "No saved usernames and passwords are available for AutoFill yet."
            } else {
                statusLabel.text = "Select the credential you want to fill."
            }

            if let requestedRecordIdentifier,
               let exact = allEntries.first(where: { $0.id == requestedRecordIdentifier }) {
                complete(with: exact)
                return
            }

            applyFilter()
        } catch {
            statusLabel.text = (error as? LocalizedError)?.errorDescription ?? "Unable to unlock PassGen AutoFill."
        }
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
                let haystack = [entry.name, entry.username, entry.url, entry.websiteDomain ?? "", entry.websiteDescription ?? ""]
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
        let candidates = [entry.websiteDomain, normalizeDomain(entry.url), normalizeDomain(entry.name)]
        return candidates.compactMap { $0 }.contains { candidate in
            candidate == requestedDomain || candidate.hasSuffix("." + requestedDomain) || requestedDomain.hasSuffix("." + candidate)
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
        let cell = tableView.dequeueReusableCell(withIdentifier: reuseIdentifier) ?? UITableViewCell(style: .subtitle, reuseIdentifier: reuseIdentifier)
        let entry = visibleEntries[indexPath.row]
        cell.textLabel?.text = entry.name.isEmpty ? entry.username : entry.name

        let subtitleParts = [entry.username, entry.websiteDomain ?? normalizeDomain(entry.url) ?? ""].filter { !$0.isEmpty }
        cell.detailTextLabel?.text = subtitleParts.joined(separator: " • ")
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        complete(with: visibleEntries[indexPath.row])
    }
}
