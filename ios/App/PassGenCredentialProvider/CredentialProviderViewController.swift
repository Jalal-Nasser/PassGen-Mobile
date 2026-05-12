import AuthenticationServices
import CommonCrypto
import CryptoKit
import LocalAuthentication
import os
import Security
import UIKit

private let passgenAutofillLog = Logger(subsystem: "com.mdeploy.passgen", category: "AutoFill")

private enum PassGenAutofillConstants {
    static let appGroupIdentifier = "group.com.mdeploy.passgen"
    static let metadataFileName = "autofill-metadata.json"
    static let encryptedVaultFileName = "passgen-vault.pgvault"
    static let keychainService = "com.passgen.native.ios"
    static let keychainAccount = "vault-master-password"
    static let accessGroupInfoKey = "PassGenKeychainAccessGroup"
}

private enum CredentialRequestKind {
    case password
    case oneTimeCode
}

private struct AutofillCredentialMetadata: Codable, Hashable {
    var id: String
    var serviceIdentifier: String
    var serviceIdentifierType: String
    var serviceName: String
    var username: String
    var domain: String?
    var hasPassword: Bool
    var hasOneTimeCode: Bool
    var updatedAt: Date

    var oneTimeCodeLabel: String {
        let trimmedService = serviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUser = username.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedService.isEmpty, !trimmedUser.isEmpty {
            return "\(trimmedService) (\(trimmedUser))"
        }
        return trimmedService.isEmpty ? "PassGen code" : trimmedService
    }
}

private struct AutofillMetadataPayload: Codable {
    var version: Int
    var updatedAt: Date
    var credentials: [AutofillCredentialMetadata]
}

private struct AutofillVaultEntry: Codable, Hashable {
    var id: String
    var name: String
    var username: String
    var password: String
    var url: String
    var notes: String
    var websitePresetId: String?
    var websiteDomain: String?
    var websiteDescription: String?
    var totpSecret: String?
    var totpIssuer: String?
    var totpAccountName: String?
    var totpDigits: Int?
    var totpPeriod: Int?
    var totpAlgorithm: String?
    var createdAt: Date
    var updatedAt: Date
}

private struct VaultPayload: Codable {
    var entries: [AutofillVaultEntry]
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

private enum AutofillVaultError: LocalizedError {
    case missingSharedVault
    case invalidVault
    case invalidPassword
    case encryptionFailure
    case missingCredential
    case oneTimeCodeUnavailable

    var errorDescription: String? {
        switch self {
        case .missingSharedVault:
            return "Open PassGen Vault, unlock the vault once, then try AutoFill again."
        case .invalidVault:
            return "PassGen Vault data is invalid."
        case .invalidPassword:
            return "Incorrect master password."
        case .encryptionFailure:
            return "Unable to decrypt PassGen Vault."
        case .missingCredential:
            return "This credential is no longer available."
        case .oneTimeCodeUnavailable:
            return "This entry does not have a valid verification code."
        }
    }
}

private enum PassGenAutofillKeychain {
    private static var sharedAccessGroup: String? {
        (Bundle.main.object(forInfoDictionaryKey: PassGenAutofillConstants.accessGroupInfoKey) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nonEmpty
    }

    static func evaluateBiometricAndReadPassword(prompt: String, completion: @escaping (String?) -> Void) {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Master Password"
        context.localizedCancelTitle = "Cancel"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            completion(nil)
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: prompt) { success, _ in
            guard success else {
                completion(nil)
                return
            }

            completion(readMasterPassword(using: context))
        }
    }

    private static func readMasterPassword(using context: LAContext) -> String? {
        context.interactionNotAllowed = true
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: PassGenAutofillConstants.keychainService,
            kSecAttrAccount as String: PassGenAutofillConstants.keychainAccount,
            kSecReturnData as String: true,
            kSecUseAuthenticationContext as String: context
        ]
        if let sharedAccessGroup {
            query[kSecAttrAccessGroup as String] = sharedAccessGroup
        }

        if let value = readPassword(query: query) {
            return value
        }

        query.removeValue(forKey: kSecAttrAccessGroup as String)
        return readPassword(query: query)
    }

    private static func readPassword(query: [String: Any]) -> String? {
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }
}

private final class PassGenAutofillVaultReader {
    private static let vaultMagic = "PASSGEN-NATIVE-IOS"
    private static let vaultVersion = 1
    private static let keyLength = 32

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: PassGenAutofillConstants.appGroupIdentifier)
    }

    func loadMetadata() -> [AutofillCredentialMetadata] {
        guard let metadataURL = containerURL?.appendingPathComponent(PassGenAutofillConstants.metadataFileName),
              let data = try? Data(contentsOf: metadataURL),
              let payload = try? Self.decoder.decode(AutofillMetadataPayload.self, from: data) else {
            return []
        }
        return payload.credentials.sorted { lhs, rhs in
            lhs.updatedAt > rhs.updatedAt
        }
    }

    func unlock(password: String) throws -> [AutofillVaultEntry] {
        guard let vaultURL = containerURL?.appendingPathComponent(PassGenAutofillConstants.encryptedVaultFileName),
              FileManager.default.fileExists(atPath: vaultURL.path) else {
            throw AutofillVaultError.missingSharedVault
        }

        let data = try Data(contentsOf: vaultURL)
        let vaultFile: VaultFile
        do {
            vaultFile = try Self.decoder.decode(VaultFile.self, from: data)
        } catch {
            throw AutofillVaultError.invalidVault
        }

        guard vaultFile.header.magic == Self.vaultMagic, vaultFile.header.version == Self.vaultVersion else {
            throw AutofillVaultError.invalidVault
        }
        guard let salt = Data(base64Encoded: vaultFile.header.salt),
              let nonceData = Data(base64Encoded: vaultFile.nonce),
              let tagData = Data(base64Encoded: vaultFile.tag),
              let cipherData = Data(base64Encoded: vaultFile.ciphertext) else {
            throw AutofillVaultError.invalidVault
        }

        let key = try deriveKey(password: password, salt: salt, iterations: vaultFile.header.iterations)
        do {
            let nonce = try AES.GCM.Nonce(data: nonceData)
            let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: cipherData, tag: tagData)
            let decrypted = try AES.GCM.open(box, using: key)
            let payload = try Self.decoder.decode(VaultPayload.self, from: decrypted)
            return payload.entries
        } catch {
            throw AutofillVaultError.invalidPassword
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
            throw AutofillVaultError.encryptionFailure
        }
        return SymmetricKey(data: derived)
    }
}

final class CredentialProviderViewController: ASCredentialProviderViewController {
    private let reader = PassGenAutofillVaultReader()
    private var visibleCredentials: [AutofillCredentialMetadata] = []
    private var requestKind: CredentialRequestKind = .password

    private lazy var tableView: UITableView = {
        let tableView = UITableView(frame: .zero, style: .insetGrouped)
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        return tableView
    }()

    private lazy var emptyLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .secondaryLabel
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureViews()
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        requestKind = .password
        visibleCredentials = filteredMetadata(for: serviceIdentifiers, kind: .password)
        renderList(emptyMessage: "No matching PassGen passwords. Unlock PassGen Vault in the app after adding credentials.")
    }

    // Third-party OTP provider visibility is available only on iOS versions whose
    // AuthenticationServices framework exposes ASOneTimeCodeCredential APIs.
    // Password AutoFill support is required; OTP visibility remains OS-gated.
    @available(iOS 18.0, *)
    override func prepareOneTimeCodeCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        requestKind = .oneTimeCode
        visibleCredentials = filteredMetadata(for: serviceIdentifiers, kind: .oneTimeCode)
        renderList(emptyMessage: "No matching PassGen verification codes.")
    }

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        cancelForUserInteraction()
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        requestKind = .password
        let recordID = credentialIdentity.recordIdentifier ?? ""
        guard let metadata = reader.loadMetadata().first(where: { $0.id == recordID && $0.hasPassword }) else {
            cancel(with: AutofillVaultError.missingCredential)
            return
        }
        authenticateAndComplete(metadata: metadata, kind: .password)
    }

    @available(iOS 17.0, *)
    override func provideCredentialWithoutUserInteraction(for credentialRequest: ASCredentialRequest) {
        cancelForUserInteraction()
    }

    @available(iOS 17.0, *)
    override func prepareInterfaceToProvideCredential(for credentialRequest: ASCredentialRequest) {
        if let passwordRequest = credentialRequest as? ASPasswordCredentialRequest {
            requestKind = .password
            guard let identity = passwordRequest.credentialIdentity as? ASPasswordCredentialIdentity else {
                cancel(with: AutofillVaultError.missingCredential)
                return
            }
            let recordID = identity.recordIdentifier ?? ""
            guard let metadata = reader.loadMetadata().first(where: { $0.id == recordID && $0.hasPassword }) else {
                cancel(with: AutofillVaultError.missingCredential)
                return
            }
            authenticateAndComplete(metadata: metadata, kind: .password)
            return
        }

        if #available(iOS 18.0, *), let codeRequest = credentialRequest as? ASOneTimeCodeCredentialRequest {
            requestKind = .oneTimeCode
            guard let identity = codeRequest.credentialIdentity as? ASOneTimeCodeCredentialIdentity else {
                cancel(with: AutofillVaultError.missingCredential)
                return
            }
            let recordID = identity.recordIdentifier ?? ""
            let entryID = recordID.replacingOccurrences(of: ":totp", with: "")
            guard let metadata = reader.loadMetadata().first(where: { $0.id == entryID && $0.hasOneTimeCode }) else {
                cancel(with: AutofillVaultError.missingCredential)
                return
            }
            authenticateAndComplete(metadata: metadata, kind: .oneTimeCode)
            return
        }

        cancel(with: AutofillVaultError.missingCredential)
    }

    override func prepareInterfaceForExtensionConfiguration() {
        visibleCredentials = reader.loadMetadata()
        renderList(emptyMessage: "Unlock PassGen Vault in the app once to enable AutoFill metadata.")
    }

    private func configureViews() {
        view.addSubview(tableView)
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            emptyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            emptyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func renderList(emptyMessage: String) {
        tableView.reloadData()
        tableView.isHidden = visibleCredentials.isEmpty
        emptyLabel.isHidden = !visibleCredentials.isEmpty
        emptyLabel.text = emptyMessage
    }

    private func filteredMetadata(for serviceIdentifiers: [ASCredentialServiceIdentifier], kind: CredentialRequestKind) -> [AutofillCredentialMetadata] {
        let metadata = reader.loadMetadata().filter { item in
            switch kind {
            case .password:
                return item.hasPassword
            case .oneTimeCode:
                return item.hasOneTimeCode
            }
        }

        guard !serviceIdentifiers.isEmpty else {
            return metadata
        }

        return metadata.filter { item in
            serviceIdentifiers.contains { serviceIdentifier in
                matches(item: item, serviceIdentifier: serviceIdentifier)
            }
        }
    }

    private func matches(item: AutofillCredentialMetadata, serviceIdentifier: ASCredentialServiceIdentifier) -> Bool {
        let requested = serviceIdentifier.identifier.lowercased()
        let requestedDomain = normalizedDomain(from: requested) ?? requested
        let itemIdentifier = item.serviceIdentifier.lowercased()
        let itemDomain = item.domain?.lowercased() ?? normalizedDomain(from: itemIdentifier) ?? itemIdentifier
        return requestedDomain == itemDomain || requestedDomain.hasSuffix(".\(itemDomain)") || itemDomain.hasSuffix(".\(requestedDomain)")
    }

    private func authenticateAndComplete(metadata: AutofillCredentialMetadata, kind: CredentialRequestKind) {
        PassGenAutofillKeychain.evaluateBiometricAndReadPassword(prompt: "Unlock PassGen Vault for AutoFill") { [weak self] password in
            DispatchQueue.main.async {
                guard let self else { return }
                if let password {
                    self.complete(metadata: metadata, kind: kind, masterPassword: password)
                } else {
                    self.presentMasterPasswordPrompt(metadata: metadata, kind: kind)
                }
            }
        }
    }

    private func presentMasterPasswordPrompt(metadata: AutofillCredentialMetadata, kind: CredentialRequestKind) {
        let alert = UIAlertController(
            title: "Unlock PassGen Vault",
            message: "Enter your master password to fill this credential.",
            preferredStyle: .alert
        )
        alert.addTextField { field in
            field.placeholder = "Master password"
            field.isSecureTextEntry = true
            field.textContentType = .password
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
            self?.cancel(with: AutofillVaultError.invalidPassword)
        })
        alert.addAction(UIAlertAction(title: "Unlock", style: .default) { [weak self, weak alert] _ in
            guard let password = alert?.textFields?.first?.text, !password.isEmpty else {
                self?.presentMasterPasswordPrompt(metadata: metadata, kind: kind)
                return
            }
            self?.complete(metadata: metadata, kind: kind, masterPassword: password)
        })
        present(alert, animated: true)
    }

    private func complete(metadata: AutofillCredentialMetadata, kind: CredentialRequestKind, masterPassword: String) {
        do {
            let entries = try reader.unlock(password: masterPassword)
            guard let entry = entries.first(where: { $0.id == metadata.id }) else {
                throw AutofillVaultError.missingCredential
            }

            switch kind {
            case .password:
                let credential = ASPasswordCredential(user: entry.username, password: entry.password)
                extensionContext.completeRequest(withSelectedCredential: credential, completionHandler: nil)
            case .oneTimeCode:
                if #available(iOS 18.0, *) {
                    guard let secret = entry.totpSecret,
                          let code = PassGenAutofillTOTP.currentCode(
                            secret: secret,
                            digits: entry.totpDigits ?? 6,
                            period: entry.totpPeriod ?? 30,
                            algorithm: entry.totpAlgorithm ?? "SHA1",
                            date: Date()
                          ) else {
                        throw AutofillVaultError.oneTimeCodeUnavailable
                    }
                    let credential = ASOneTimeCodeCredential(code: code)
                    extensionContext.completeOneTimeCodeRequest(using: credential, completionHandler: nil)
                } else {
                    throw AutofillVaultError.oneTimeCodeUnavailable
                }
            }
        } catch {
            passgenAutofillLog.error("Credential completion failed: \(error.localizedDescription, privacy: .public)")
            showRetryableError(error, metadata: metadata, kind: kind)
        }
    }

    private func showRetryableError(_ error: Error, metadata: AutofillCredentialMetadata, kind: CredentialRequestKind) {
        let message = (error as? LocalizedError)?.errorDescription ?? "Unable to unlock PassGen Vault."
        let alert = UIAlertController(title: "PassGen AutoFill", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
            self?.cancel(with: error)
        })
        alert.addAction(UIAlertAction(title: "Try Again", style: .default) { [weak self] _ in
            self?.presentMasterPasswordPrompt(metadata: metadata, kind: kind)
        })
        present(alert, animated: true)
    }

    private func cancelForUserInteraction() {
        let error = NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.userInteractionRequired.rawValue,
            userInfo: nil
        )
        extensionContext.cancelRequest(withError: error)
    }

    private func cancel(with error: Error) {
        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        let nsError = NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.failed.rawValue,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
        extensionContext.cancelRequest(withError: nsError)
    }
}

extension CredentialProviderViewController: UITableViewDataSource, UITableViewDelegate {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        visibleCredentials.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
        let item = visibleCredentials[indexPath.row]
        cell.textLabel?.text = requestKind == .oneTimeCode ? item.oneTimeCodeLabel : item.serviceName
        cell.detailTextLabel?.text = requestKind == .oneTimeCode ? "Verification code" : item.username
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        authenticateAndComplete(metadata: visibleCredentials[indexPath.row], kind: requestKind)
    }
}

private enum PassGenAutofillTOTP {
    static func currentCode(secret: String, digits: Int, period: Int, algorithm: String, date: Date) -> String? {
        guard let key = decodeBase32(secret) else { return nil }
        let counter = UInt64(floor(date.timeIntervalSince1970 / Double(max(1, period))))
        var movingFactor = counter.bigEndian
        let message = Data(bytes: &movingFactor, count: MemoryLayout<UInt64>.size)

        let digestInfo: (algorithm: CCHmacAlgorithm, length: Int)
        switch algorithm.uppercased() {
        case "SHA256":
            digestInfo = (CCHmacAlgorithm(kCCHmacAlgSHA256), Int(CC_SHA256_DIGEST_LENGTH))
        case "SHA512":
            digestInfo = (CCHmacAlgorithm(kCCHmacAlgSHA512), Int(CC_SHA512_DIGEST_LENGTH))
        default:
            digestInfo = (CCHmacAlgorithm(kCCHmacAlgSHA1), Int(CC_SHA1_DIGEST_LENGTH))
        }

        var digest = [UInt8](repeating: 0, count: digestInfo.length)
        key.withUnsafeBytes { keyPointer in
            message.withUnsafeBytes { messagePointer in
                CCHmac(
                    digestInfo.algorithm,
                    keyPointer.baseAddress,
                    key.count,
                    messagePointer.baseAddress,
                    message.count,
                    &digest
                )
            }
        }

        guard let last = digest.last else { return nil }
        let offset = Int(last & 0x0f)
        guard offset + 3 < digest.count else { return nil }

        let binary = (UInt32(digest[offset] & 0x7f) << 24)
            | (UInt32(digest[offset + 1]) << 16)
            | (UInt32(digest[offset + 2]) << 8)
            | UInt32(digest[offset + 3])
        let normalizedDigits = max(6, min(8, digits))
        let modulo = UInt32(pow(10.0, Double(normalizedDigits)))
        let otp = binary % modulo
        return String(format: "%0*u", normalizedDigits, otp)
    }

    private static func decodeBase32(_ input: String) -> Data? {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")
        var lookup: [Character: UInt8] = [:]
        for (index, char) in alphabet.enumerated() {
            lookup[char] = UInt8(index)
        }

        let cleaned = input
            .uppercased()
            .replacingOccurrences(of: "=", with: "")
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")

        var buffer: UInt32 = 0
        var bitsLeft = 0
        var output = Data()

        for char in cleaned {
            guard let value = lookup[char] else { return nil }
            buffer = (buffer << 5) | UInt32(value)
            bitsLeft += 5
            if bitsLeft >= 8 {
                let byte = UInt8((buffer >> UInt32(bitsLeft - 8)) & 0xff)
                output.append(byte)
                bitsLeft -= 8
            }
        }

        return output
    }
}

private func normalizedDomain(from rawURL: String) -> String? {
    let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    if let directURL = URL(string: trimmed), let host = directURL.host {
        return host.replacingOccurrences(of: "www.", with: "")
    }

    if let prefixed = URL(string: "https://\(trimmed)"), let host = prefixed.host {
        return host.replacingOccurrences(of: "www.", with: "")
    }

    return nil
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
