
import UIKit
import SwiftUI
import CryptoKit
import CommonCrypto
import UniformTypeIdentifiers
import LocalAuthentication
import AuthenticationServices

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
            return "Up to 4 passwords (local only)"
        case .pro:
            return "Unlimited passwords + exports"
        case .cloud:
            return "Unlimited + cloud backup tools"
        }
    }

    var priceLabel: String {
        switch self {
        case .free:
            return "$0/mo"
        case .pro:
            return "$2.99/mo"
        case .cloud:
            return "$4.99/mo"
        }
    }

    var features: [String] {
        switch self {
        case .free:
            return [
                "Store up to 4 passwords",
                "Local encrypted vault",
                "Basic password generator"
            ]
        case .pro:
            return [
                "Unlimited password entries",
                "Export encrypted backups",
                "Developer API key generation"
            ]
        case .cloud:
            return [
                "Everything in PRO",
                "Import from iCloud Drive / Google Drive",
                "Export to iCloud Drive / Google Drive"
            ]
        }
    }
}

private struct OnboardingPage: Identifiable {
    let id: Int
    let title: String
    let subtitle: String
    let systemImage: String
}

private struct WebsitePreset: Identifiable, Hashable {
    let id: String
    let name: String
    let domain: String
    let loginURL: String
    let description: String
    let keywords: [String]
}

private let websitePresets: [WebsitePreset] = [
    WebsitePreset(id: "amazon", name: "Amazon", domain: "amazon.com", loginURL: "https://www.amazon.com/ap/signin", description: "Online shopping and digital services.", keywords: ["shopping", "marketplace", "retail"]),
    WebsitePreset(id: "dropbox", name: "Dropbox", domain: "dropbox.com", loginURL: "https://www.dropbox.com/login", description: "Cloud file storage and sync service.", keywords: ["cloud", "files", "storage"]),
    WebsitePreset(id: "facebook", name: "Facebook", domain: "facebook.com", loginURL: "https://www.facebook.com/login", description: "Social networking platform.", keywords: ["social", "meta"]),
    WebsitePreset(id: "gmail", name: "Gmail", domain: "gmail.com", loginURL: "https://mail.google.com", description: "Google email service.", keywords: ["email", "google", "mail"]),
    WebsitePreset(id: "instagram", name: "Instagram", domain: "instagram.com", loginURL: "https://www.instagram.com/accounts/login/", description: "Photo and video sharing platform.", keywords: ["social", "photos", "meta"]),
    WebsitePreset(id: "linkedin", name: "LinkedIn", domain: "linkedin.com", loginURL: "https://www.linkedin.com/login", description: "Professional networking platform.", keywords: ["jobs", "career", "social"]),
    WebsitePreset(id: "outlook", name: "Outlook", domain: "outlook.live.com", loginURL: "https://outlook.live.com", description: "Microsoft email and productivity account.", keywords: ["email", "microsoft", "mail"]),
    WebsitePreset(id: "pinterest", name: "Pinterest", domain: "pinterest.com", loginURL: "https://www.pinterest.com/login/", description: "Image discovery and bookmarking platform.", keywords: ["social", "images", "ideas"]),
    WebsitePreset(id: "reddit", name: "Reddit", domain: "reddit.com", loginURL: "https://www.reddit.com/login/", description: "Community discussion platform.", keywords: ["forum", "community", "social"]),
    WebsitePreset(id: "twitter", name: "Twitter", domain: "twitter.com", loginURL: "https://x.com/i/flow/login", description: "Social network now known as X.", keywords: ["x", "social"]),
    WebsitePreset(id: "x", name: "X", domain: "x.com", loginURL: "https://x.com/i/flow/login", description: "Social network formerly known as Twitter.", keywords: ["twitter", "social"]),
    WebsitePreset(id: "yahoo", name: "Yahoo", domain: "yahoo.com", loginURL: "https://login.yahoo.com", description: "Email, news, and web portal services.", keywords: ["mail", "email", "portal"]),
    WebsitePreset(id: "zoho", name: "Zoho", domain: "zoho.com", loginURL: "https://accounts.zoho.com/signin", description: "Business software and productivity suite.", keywords: ["crm", "business", "productivity"]),
    WebsitePreset(id: "github", name: "GitHub", domain: "github.com", loginURL: "https://github.com/login", description: "Code hosting and developer collaboration.", keywords: ["git", "code", "developer"]),
    WebsitePreset(id: "gitlab", name: "GitLab", domain: "gitlab.com", loginURL: "https://gitlab.com/users/sign_in", description: "DevOps platform and code collaboration.", keywords: ["git", "code", "ci"]),
    WebsitePreset(id: "stackoverflow", name: "Stack Overflow", domain: "stackoverflow.com", loginURL: "https://stackoverflow.com/users/login", description: "Developer Q&A platform.", keywords: ["programming", "developer", "forum"]),
    WebsitePreset(id: "google", name: "Google", domain: "google.com", loginURL: "https://accounts.google.com", description: "Google account sign-in.", keywords: ["search", "account", "gmail"]),
    WebsitePreset(id: "microsoft", name: "Microsoft", domain: "microsoft.com", loginURL: "https://login.live.com", description: "Microsoft account services.", keywords: ["windows", "office", "account"]),
    WebsitePreset(id: "apple", name: "Apple ID", domain: "apple.com", loginURL: "https://appleid.apple.com", description: "Apple account and iCloud access.", keywords: ["icloud", "ios", "mac"]),
    WebsitePreset(id: "icloud", name: "iCloud", domain: "icloud.com", loginURL: "https://www.icloud.com", description: "Apple cloud services and sync.", keywords: ["apple", "cloud", "storage"]),
    WebsitePreset(id: "onedrive", name: "OneDrive", domain: "onedrive.live.com", loginURL: "https://onedrive.live.com", description: "Microsoft cloud storage service.", keywords: ["cloud", "files", "microsoft"]),
    WebsitePreset(id: "googledrive", name: "Google Drive", domain: "drive.google.com", loginURL: "https://drive.google.com", description: "Google cloud file storage.", keywords: ["cloud", "files", "google"]),
    WebsitePreset(id: "discord", name: "Discord", domain: "discord.com", loginURL: "https://discord.com/login", description: "Community chat and voice platform.", keywords: ["chat", "community", "gaming"]),
    WebsitePreset(id: "slack", name: "Slack", domain: "slack.com", loginURL: "https://slack.com/signin", description: "Team messaging and collaboration.", keywords: ["work", "chat", "team"]),
    WebsitePreset(id: "notion", name: "Notion", domain: "notion.so", loginURL: "https://www.notion.so/login", description: "Workspace for notes and docs.", keywords: ["notes", "workspace", "productivity"]),
    WebsitePreset(id: "trello", name: "Trello", domain: "trello.com", loginURL: "https://trello.com/login", description: "Project boards and task tracking.", keywords: ["project", "kanban", "tasks"]),
    WebsitePreset(id: "asana", name: "Asana", domain: "asana.com", loginURL: "https://app.asana.com/-/login", description: "Work and project management platform.", keywords: ["project", "tasks", "team"]),
    WebsitePreset(id: "canva", name: "Canva", domain: "canva.com", loginURL: "https://www.canva.com/login", description: "Design and content creation platform.", keywords: ["design", "graphics", "creative"]),
    WebsitePreset(id: "figma", name: "Figma", domain: "figma.com", loginURL: "https://www.figma.com/login", description: "Collaborative design and prototyping.", keywords: ["design", "ui", "ux"]),
    WebsitePreset(id: "adobe", name: "Adobe", domain: "adobe.com", loginURL: "https://account.adobe.com", description: "Creative cloud and Adobe services.", keywords: ["creative", "design", "photoshop"]),
    WebsitePreset(id: "paypal", name: "PayPal", domain: "paypal.com", loginURL: "https://www.paypal.com/signin", description: "Online payments and transfers.", keywords: ["payments", "finance", "wallet"]),
    WebsitePreset(id: "ebay", name: "eBay", domain: "ebay.com", loginURL: "https://signin.ebay.com", description: "Online auctions and marketplace.", keywords: ["shopping", "marketplace"]),
    WebsitePreset(id: "netflix", name: "Netflix", domain: "netflix.com", loginURL: "https://www.netflix.com/login", description: "Streaming entertainment platform.", keywords: ["streaming", "video"]),
    WebsitePreset(id: "spotify", name: "Spotify", domain: "spotify.com", loginURL: "https://accounts.spotify.com/login", description: "Music and podcast streaming.", keywords: ["music", "audio", "streaming"]),
    WebsitePreset(id: "youtube", name: "YouTube", domain: "youtube.com", loginURL: "https://accounts.google.com", description: "Video sharing and streaming service.", keywords: ["video", "google", "streaming"]),
    WebsitePreset(id: "twitch", name: "Twitch", domain: "twitch.tv", loginURL: "https://www.twitch.tv/login", description: "Live streaming platform.", keywords: ["streaming", "gaming", "live"]),
    WebsitePreset(id: "tiktok", name: "TikTok", domain: "tiktok.com", loginURL: "https://www.tiktok.com/login", description: "Short-form video social platform.", keywords: ["video", "social"]),
    WebsitePreset(id: "snapchat", name: "Snapchat", domain: "snapchat.com", loginURL: "https://accounts.snapchat.com", description: "Messaging and social media app.", keywords: ["chat", "social", "stories"]),
    WebsitePreset(id: "medium", name: "Medium", domain: "medium.com", loginURL: "https://medium.com/m/signin", description: "Publishing and blogging platform.", keywords: ["writing", "blog", "articles"]),
    WebsitePreset(id: "quora", name: "Quora", domain: "quora.com", loginURL: "https://www.quora.com", description: "Question and answer platform.", keywords: ["q&a", "community", "answers"]),
    WebsitePreset(id: "tumblr", name: "Tumblr", domain: "tumblr.com", loginURL: "https://www.tumblr.com/login", description: "Microblogging social platform.", keywords: ["blog", "social"]),
    WebsitePreset(id: "steam", name: "Steam", domain: "steampowered.com", loginURL: "https://store.steampowered.com/login", description: "PC game store and community.", keywords: ["gaming", "games", "pc"]),
    WebsitePreset(id: "epic", name: "Epic Games", domain: "epicgames.com", loginURL: "https://www.epicgames.com/id/login", description: "Game store and account platform.", keywords: ["gaming", "fortnite", "games"]),
    WebsitePreset(id: "playstation", name: "PlayStation", domain: "playstation.com", loginURL: "https://my.account.sony.com", description: "PlayStation network account services.", keywords: ["gaming", "sony", "psn"]),
    WebsitePreset(id: "nintendo", name: "Nintendo", domain: "nintendo.com", loginURL: "https://accounts.nintendo.com", description: "Nintendo account services.", keywords: ["gaming", "switch"]),
    WebsitePreset(id: "airbnb", name: "Airbnb", domain: "airbnb.com", loginURL: "https://www.airbnb.com/login", description: "Travel stays and hosting platform.", keywords: ["travel", "booking", "stays"]),
    WebsitePreset(id: "booking", name: "Booking.com", domain: "booking.com", loginURL: "https://account.booking.com/sign-in", description: "Hotel and accommodation booking.", keywords: ["travel", "hotel", "booking"]),
    WebsitePreset(id: "uber", name: "Uber", domain: "uber.com", loginURL: "https://auth.uber.com", description: "Ride-hailing and delivery services.", keywords: ["rides", "transport"]),
    WebsitePreset(id: "lyft", name: "Lyft", domain: "lyft.com", loginURL: "https://account.lyft.com/auth", description: "Ride-hailing service platform.", keywords: ["rides", "transport"]),
    WebsitePreset(id: "doordash", name: "DoorDash", domain: "doordash.com", loginURL: "https://www.doordash.com/consumer/login", description: "Food delivery platform.", keywords: ["delivery", "food"]),
    WebsitePreset(id: "uber_eats", name: "Uber Eats", domain: "ubereats.com", loginURL: "https://www.ubereats.com/login", description: "Food delivery by Uber.", keywords: ["delivery", "food"]),
    WebsitePreset(id: "robinhood", name: "Robinhood", domain: "robinhood.com", loginURL: "https://robinhood.com/login", description: "Investing and brokerage platform.", keywords: ["finance", "stocks", "investing"]),
    WebsitePreset(id: "coinbase", name: "Coinbase", domain: "coinbase.com", loginURL: "https://www.coinbase.com/signin", description: "Cryptocurrency exchange platform.", keywords: ["crypto", "finance", "exchange"]),
    WebsitePreset(id: "binance", name: "Binance", domain: "binance.com", loginURL: "https://accounts.binance.com", description: "Cryptocurrency exchange.", keywords: ["crypto", "exchange", "finance"]),
    WebsitePreset(id: "chase", name: "Chase", domain: "chase.com", loginURL: "https://secure.chase.com", description: "Banking and credit card accounts.", keywords: ["bank", "finance", "cards"]),
    WebsitePreset(id: "bankofamerica", name: "Bank of America", domain: "bankofamerica.com", loginURL: "https://secure.bankofamerica.com", description: "Online banking and account access.", keywords: ["bank", "finance"]),
    WebsitePreset(id: "wellsfargo", name: "Wells Fargo", domain: "wellsfargo.com", loginURL: "https://connect.secure.wellsfargo.com", description: "Banking and loan services.", keywords: ["bank", "finance"]),
    WebsitePreset(id: "capitalone", name: "Capital One", domain: "capitalone.com", loginURL: "https://verified.capitalone.com/sign-in", description: "Banking and credit accounts.", keywords: ["bank", "finance", "cards"]),
    WebsitePreset(id: "americanexpress", name: "American Express", domain: "americanexpress.com", loginURL: "https://www.americanexpress.com/en-us/account/login", description: "Credit card and financial services.", keywords: ["cards", "finance"]),
    WebsitePreset(id: "aws", name: "AWS", domain: "aws.amazon.com", loginURL: "https://signin.aws.amazon.com", description: "Amazon cloud platform account.", keywords: ["cloud", "developer", "infra"]),
    WebsitePreset(id: "cloudflare", name: "Cloudflare", domain: "cloudflare.com", loginURL: "https://dash.cloudflare.com/login", description: "Web performance and security platform.", keywords: ["dns", "security", "cloud"]),
    WebsitePreset(id: "digitalocean", name: "DigitalOcean", domain: "digitalocean.com", loginURL: "https://cloud.digitalocean.com/login", description: "Cloud infrastructure provider.", keywords: ["cloud", "infra", "developer"]),
    WebsitePreset(id: "heroku", name: "Heroku", domain: "heroku.com", loginURL: "https://id.heroku.com/login", description: "Cloud app platform for deployment.", keywords: ["cloud", "developer", "hosting"]),
    WebsitePreset(id: "vercel", name: "Vercel", domain: "vercel.com", loginURL: "https://vercel.com/login", description: "Frontend cloud deployment platform.", keywords: ["hosting", "frontend", "developer"]),
    WebsitePreset(id: "netlify", name: "Netlify", domain: "netlify.com", loginURL: "https://app.netlify.com/login", description: "Web deployment and hosting service.", keywords: ["hosting", "web", "developer"]),
    WebsitePreset(id: "proton", name: "Proton Mail", domain: "proton.me", loginURL: "https://mail.proton.me", description: "Encrypted email and privacy services.", keywords: ["email", "privacy", "mail"]),
    WebsitePreset(id: "telegram", name: "Telegram", domain: "telegram.org", loginURL: "https://web.telegram.org", description: "Messaging platform with cloud sync.", keywords: ["chat", "messaging"]),
    WebsitePreset(id: "whatsapp", name: "WhatsApp", domain: "whatsapp.com", loginURL: "https://web.whatsapp.com", description: "Messaging platform by Meta.", keywords: ["chat", "messaging", "social"]),
    WebsitePreset(id: "shopify", name: "Shopify", domain: "shopify.com", loginURL: "https://accounts.shopify.com/store-login", description: "E-commerce platform and merchant tools.", keywords: ["ecommerce", "store", "business"]),
    WebsitePreset(id: "salesforce", name: "Salesforce", domain: "salesforce.com", loginURL: "https://login.salesforce.com", description: "CRM and business platform.", keywords: ["crm", "business", "sales"]),
    WebsitePreset(id: "atlassian", name: "Atlassian", domain: "atlassian.com", loginURL: "https://id.atlassian.com/login", description: "Jira, Confluence, and team tools.", keywords: ["jira", "confluence", "work"])
]

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
    var websitePresetId: String?
    var websiteDomain: String?
    var websiteDescription: String?
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
    var websitePresetId: String?
    var websiteDomain: String?
    var websiteDescription: String?
    var createdAt: Date?

    static let empty = VaultEntryDraft(
        id: nil,
        name: "",
        username: "",
        password: "",
        url: "",
        notes: "",
        websitePresetId: nil,
        websiteDomain: nil,
        websiteDescription: nil,
        createdAt: nil
    )

    init(entry: VaultEntry) {
        self.id = entry.id
        self.name = entry.name
        self.username = entry.username
        self.password = entry.password
        self.url = entry.url
        self.notes = entry.notes
        self.websitePresetId = entry.websitePresetId
        self.websiteDomain = entry.websiteDomain
        self.websiteDescription = entry.websiteDescription
        self.createdAt = entry.createdAt
    }

    init(
        id: String?,
        name: String,
        username: String,
        password: String,
        url: String,
        notes: String,
        websitePresetId: String?,
        websiteDomain: String?,
        websiteDescription: String?,
        createdAt: Date?
    ) {
        self.id = id
        self.name = name
        self.username = username
        self.password = password
        self.url = url
        self.notes = notes
        self.websitePresetId = websitePresetId
        self.websiteDomain = websiteDomain
        self.websiteDescription = websiteDescription
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
            websitePresetId: websitePresetId,
            websiteDomain: websiteDomain,
            websiteDescription: websiteDescription,
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

private struct VaultBackupPayload: Codable {
    var version: Int
    var exportedAt: Date
    var source: String
    var entries: [VaultEntry]
}

private extension UTType {
    static let passgenBackup = UTType(exportedAs: "com.passgen.vault.backup", conformingTo: .json)
}

private struct VaultBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.passgenBackup, .json] }
    static var writableContentTypes: [UTType] { [.passgenBackup, .json] }

    var payload: VaultBackupPayload

    init(payload: VaultBackupPayload) {
        self.payload = payload
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let parsed = try? decoder.decode(VaultBackupPayload.self, from: data) {
            payload = parsed
            return
        }

        // Backward compatibility: import plain array exports if needed.
        if let entries = try? decoder.decode([VaultEntry].self, from: data) {
            payload = VaultBackupPayload(
                version: 1,
                exportedAt: Date(),
                source: "legacy",
                entries: entries
            )
            return
        }

        throw CocoaError(.fileReadCorruptFile)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(payload)
        return .init(regularFileWithContents: data)
    }
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

private enum NativeKeychain {
    private static let service = "com.passgen.native.ios"
    private static let account = "vault-master-password"

    static func saveMasterPassword(_ password: String) {
        deleteMasterPassword()

        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .userPresence,
            nil
        ) else { return }

        guard let passwordData = password.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessControl as String: accessControl,
            kSecValueData as String: passwordData
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    static func readMasterPassword(prompt: String) -> String? {
        var item: CFTypeRef?
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecUseOperationPrompt as String: prompt
        ]

        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    static func deleteMasterPassword() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
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

    func importEntries(_ importedEntries: [VaultEntry]) throws -> Int {
        guard var payload = cachedPayload else {
            throw VaultStoreError.locked
        }

        var importedCount = 0
        for entry in importedEntries {
            if let index = payload.entries.firstIndex(where: { $0.id == entry.id }) {
                payload.entries[index] = entry
            } else {
                payload.entries.append(entry)
            }
            importedCount += 1
        }

        cachedPayload = payload
        try persist()
        return importedCount
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
    @Published var showWebsitePicker = false
    @Published var websiteQuery = ""
    @Published var draft = VaultEntryDraft.empty
    @Published var showResetPrompt = false
    @Published var showPlanSheet = false
    @Published var selectedTier: PremiumTier = .free
    @Published var passkeyUnlockEnabled = false
    @Published var authProviderLabel = "Not Connected"
    @Published var authEmail = ""
    @Published var developerAPIKey = ""
    @Published var selectedDeveloperTarget = "Vercel"

    @Published var generatedPassword = ""
    @Published var length = 18
    @Published var includeUppercase = true
    @Published var includeLowercase = true
    @Published var includeNumbers = true
    @Published var includeSymbols = true

    private let hintStorageKey = "passgen-password-hint"
    private let onboardingStorageKey = "passgen-onboarding-complete-native"
    private let planStorageKey = "passgen-plan-tier-native"
    private let passkeyEnabledStorageKey = "passgen-passkey-enabled-native"
    private let authProviderStorageKey = "passgen-auth-provider-native"
    private let authEmailStorageKey = "passgen-auth-email-native"
    private let developerAPIKeyStorageKey = "passgen-dev-api-key-native"
    private let store = NativeVaultStore()
    private var lastSuccessfulPassword = ""
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

    var isPaidTier: Bool {
        selectedTier == .pro || selectedTier == .cloud
    }

    var hasCloudTools: Bool {
        selectedTier == .cloud
    }

    var developerTargets: [String] {
        ["Vercel", "Replit", "VS Code Mobile"]
    }

    var developerAPISnippet: String {
        """
        const PASSGEN_API_KEY = "\(developerAPIKey)";
        const PASSGEN_BACKUP_ENDPOINT = "https://api.passgen.app/v1/vault/backup";
        // Use this key from \(selectedDeveloperTarget) with HTTPS requests.
        """
    }

    var selectedWebsiteName: String {
        if let presetID = draft.websitePresetId,
           let preset = websitePresets.first(where: { $0.id == presetID }) {
            return preset.name
        }
        return draft.name
    }

    var filteredWebsitePresets: [WebsitePreset] {
        let query = websiteQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return websitePresets }

        return websitePresets.filter { preset in
            if preset.name.lowercased().contains(query) { return true }
            if preset.domain.lowercased().contains(query) { return true }
            if preset.keywords.contains(where: { $0.lowercased().contains(query) }) { return true }
            return false
        }
    }

    var filteredEntries: [VaultEntry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return entries }

        return entries.filter { entry in
            [entry.name, entry.username, entry.url, entry.notes, entry.websiteDomain ?? "", entry.websiteDescription ?? ""]
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
        passkeyUnlockEnabled = UserDefaults.standard.bool(forKey: passkeyEnabledStorageKey)
        authProviderLabel = UserDefaults.standard.string(forKey: authProviderStorageKey) ?? "Not Connected"
        authEmail = UserDefaults.standard.string(forKey: authEmailStorageKey) ?? ""
        developerAPIKey = UserDefaults.standard.string(forKey: developerAPIKeyStorageKey) ?? ""
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
        let enteredPassword = masterPassword
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
            lastSuccessfulPassword = enteredPassword

            if passkeyUnlockEnabled {
                NativeKeychain.saveMasterPassword(enteredPassword)
            }

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
        lastSuccessfulPassword = ""
    }

    func setPasskeyUnlockEnabled(_ enabled: Bool) {
        passkeyUnlockEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: passkeyEnabledStorageKey)

        if enabled {
            if !lastSuccessfulPassword.isEmpty {
                NativeKeychain.saveMasterPassword(lastSuccessfulPassword)
                alertState = AlertState(message: "Passkey unlock enabled. You can unlock using Face ID / Passcode.")
            } else {
                alertState = AlertState(message: "Passkey unlock will activate after your next manual unlock.")
            }
        } else {
            NativeKeychain.deleteMasterPassword()
            alertState = AlertState(message: "Passkey unlock disabled.")
        }
    }

    func unlockWithPasskey() {
        guard hasVault else {
            alertState = AlertState(message: "Create your vault first, then enable passkey unlock.")
            return
        }

        guard passkeyUnlockEnabled else {
            alertState = AlertState(message: "Enable passkey unlock from Settings first.")
            return
        }

        guard let storedPassword = NativeKeychain.readMasterPassword(prompt: "Unlock PassGen Vault") else {
            alertState = AlertState(message: "Passkey unlock is not ready. Unlock once with your master password.")
            return
        }

        masterPassword = storedPassword
        unlockVault()
    }

    func connectAppleAccount(email: String?) {
        authProviderLabel = "Apple"
        authEmail = email ?? ""
        UserDefaults.standard.set(authProviderLabel, forKey: authProviderStorageKey)
        UserDefaults.standard.set(authEmail, forKey: authEmailStorageKey)
        alertState = AlertState(message: "Signed in with Apple.")
    }

    func connectGoogleAccount() {
        authProviderLabel = "Google"
        UserDefaults.standard.set(authProviderLabel, forKey: authProviderStorageKey)
        alertState = AlertState(message: "Google button is ready. Add client credentials in iOS config to complete live OAuth.")
    }

    func disconnectAccount() {
        authProviderLabel = "Not Connected"
        authEmail = ""
        UserDefaults.standard.removeObject(forKey: authProviderStorageKey)
        UserDefaults.standard.removeObject(forKey: authEmailStorageKey)
        alertState = AlertState(message: "Account disconnected.")
    }

    func generateDeveloperAPIKey() {
        guard isPaidTier else {
            alertState = AlertState(message: "Developer API keys are available for PRO and CLOUD plans.")
            showPlanSheet = true
            return
        }

        developerAPIKey = makeRandomAPIKey()
        UserDefaults.standard.set(developerAPIKey, forKey: developerAPIKeyStorageKey)
        alertState = AlertState(message: "Developer API key generated.")
    }

    func revokeDeveloperAPIKey() {
        developerAPIKey = ""
        UserDefaults.standard.removeObject(forKey: developerAPIKeyStorageKey)
        alertState = AlertState(message: "Developer API key revoked.")
    }

    func makeBackupDocument() -> VaultBackupDocument? {
        guard isUnlocked else {
            alertState = AlertState(message: "Unlock your vault before exporting.")
            return nil
        }

        guard isPaidTier else {
            alertState = AlertState(message: "Password export is available for paid users (PRO/CLOUD).")
            showPlanSheet = true
            return nil
        }

        let payload = VaultBackupPayload(
            version: 1,
            exportedAt: Date(),
            source: "PassGen iOS",
            entries: entries
        )

        return VaultBackupDocument(payload: payload)
    }

    func importBackupDocument(_ document: VaultBackupDocument) {
        guard isUnlocked else {
            alertState = AlertState(message: "Unlock your vault before importing backups.")
            return
        }

        guard hasCloudTools else {
            alertState = AlertState(message: "Import from iCloud/Google Drive is available on the CLOUD monthly plan.")
            showPlanSheet = true
            return
        }

        let now = Date()
        var existingIDs = Set(entries.map(\.id))
        var normalizedEntries: [VaultEntry] = []
        normalizedEntries.reserveCapacity(document.payload.entries.count)

        for var imported in document.payload.entries {
            if imported.id.isEmpty || existingIDs.contains(imported.id) {
                imported.id = UUID().uuidString
            }
            existingIDs.insert(imported.id)

            if let parsedDomain = normalizedDomain(from: imported.url) {
                imported.websiteDomain = parsedDomain
            }

            if imported.createdAt > now {
                imported.createdAt = now
            }
            imported.updatedAt = now
            normalizedEntries.append(imported)
        }

        do {
            let importedCount = try store.importEntries(normalizedEntries)
            refreshEntries()
            alertState = AlertState(message: "Imported \(importedCount) passwords from backup.")
        } catch {
            alertState = AlertState(message: "Unable to import this backup file.")
        }
    }

    func importBackupData(_ data: Data) {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        if let payload = try? decoder.decode(VaultBackupPayload.self, from: data) {
            importBackupDocument(VaultBackupDocument(payload: payload))
            return
        }

        if let legacyEntries = try? decoder.decode([VaultEntry].self, from: data) {
            let legacyPayload = VaultBackupPayload(
                version: 1,
                exportedAt: Date(),
                source: "legacy",
                entries: legacyEntries
            )
            importBackupDocument(VaultBackupDocument(payload: legacyPayload))
            return
        }

        alertState = AlertState(message: "Unsupported backup format.")
    }

    private func makeRandomAPIKey() -> String {
        var bytes = [UInt8](repeating: 0, count: 24)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            return "pg_live_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        }
        let data = Data(bytes)
        let token = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "pg_live_\(token)"
    }

    func refreshEntries() {
        do {
            entries = try store.listEntries()
        } catch {
            alertState = AlertState(message: "Unable to load vault entries.")
        }
    }

    func openWebsitePicker() {
        websiteQuery = ""
        showWebsitePicker = true
    }

    func applyWebsitePreset(_ preset: WebsitePreset) {
        draft.websitePresetId = preset.id
        draft.websiteDomain = preset.domain
        draft.websiteDescription = preset.description
        draft.name = preset.name

        let currentURL = draft.url.trimmingCharacters(in: .whitespacesAndNewlines)
        if currentURL.isEmpty || normalizedDomain(from: currentURL) == draft.websiteDomain {
            draft.url = preset.loginURL
        }

        showWebsitePicker = false
    }

    func startCreateEntry(seedPassword: String? = nil) {
        if selectedTier == .free && entries.count >= freePlanLimit {
            alertState = AlertState(message: "Free plan allows up to 4 passwords. Upgrade to PRO for unlimited entries.")
            showPlanSheet = true
            return
        }
        draft = .empty
        websiteQuery = ""
        showWebsitePicker = false
        if let seedPassword {
            draft.password = seedPassword
        }
        showEditorSheet = true
    }

    func startEditEntry(_ entry: VaultEntry) {
        draft = VaultEntryDraft(entry: entry)
        websiteQuery = ""
        showWebsitePicker = false
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
            let parsedDomain = normalizedDomain(from: draft.url)
            if let parsedDomain {
                draft.websiteDomain = parsedDomain
            } else if (draft.websiteDomain ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                draft.websiteDomain = nil
            }
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
            UserDefaults.standard.removeObject(forKey: passkeyEnabledStorageKey)
            UserDefaults.standard.removeObject(forKey: authProviderStorageKey)
            UserDefaults.standard.removeObject(forKey: authEmailStorageKey)
            UserDefaults.standard.removeObject(forKey: developerAPIKeyStorageKey)
            NativeKeychain.deleteMasterPassword()

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
            showWebsitePicker = false
            websiteQuery = ""
            showPlanSheet = false
            activeTab = .vault
            selectedTier = .free
            passkeyUnlockEnabled = false
            authProviderLabel = "Not Connected"
            authEmail = ""
            developerAPIKey = ""
            generatedPassword = generatePassword()
            lastSuccessfulPassword = ""
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
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(tier.title)
                                .font(.system(size: 17, weight: .bold))
                            Spacer()
                            Text(tier.priceLabel)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                        }

                        Text(tier.subtitle)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(.secondary)

                        ForEach(tier.features, id: \.self) { feature in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                                Text(feature)
                                    .font(.system(size: 14, weight: .regular))
                            }
                        }

                        Text("Billed monthly")
                            .font(.system(size: 12, weight: .semibold))
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

                if viewModel.hasVault && viewModel.passkeyUnlockEnabled {
                    Button {
                        viewModel.unlockWithPasskey()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "faceid")
                            Text("Unlock with Face ID / Passcode")
                        }
                        .font(.system(size: 16, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Color.white.opacity(0.92))
                        .foregroundColor(Color(red: 42 / 255, green: 49 / 255, blue: 92 / 255))
                        .cornerRadius(12)
                    }
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
                    HStack(spacing: 12) {
                        WebsiteBrandIconView(
                            domain: entry.websiteDomain ?? normalizedDomain(from: entry.url),
                            title: entry.name,
                            size: 42
                        )

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
                                    .lineLimit(1)
                            }
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
    @State private var showImportPicker = false
    @State private var showExportPicker = false
    @State private var exportDocument: VaultBackupDocument?
    @State private var exportFilename = "passgen-vault-backup"

    private var passkeyBinding: Binding<Bool> {
        Binding(
            get: { viewModel.passkeyUnlockEnabled },
            set: { viewModel.setPasskeyUnlockEnabled($0) }
        )
    }

    private func makeExportFilename() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "passgen-vault-backup-\(formatter.string(from: Date()))"
    }

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
                    HStack {
                        Text("Connected Account")
                        Spacer()
                        Text(viewModel.authProviderLabel)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.secondary)
                    }

                    if !viewModel.authEmail.isEmpty {
                        Text(viewModel.authEmail)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }

                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        switch result {
                        case .success(let authorization):
                            if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
                                viewModel.connectAppleAccount(email: credential.email)
                            } else {
                                viewModel.connectAppleAccount(email: nil)
                            }
                        case .failure(let error):
                            viewModel.alertState = AlertState(message: "Apple sign-in failed: \(error.localizedDescription)")
                        }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 46)

                    Button {
                        viewModel.connectGoogleAccount()
                    } label: {
                        HStack(spacing: 10) {
                            WebsiteBrandIconView(domain: "google.com", title: "Google", size: 20)
                            Text("Continue with Google")
                            Spacer()
                            if viewModel.authProviderLabel == "Google" {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                            }
                        }
                    }

                    if viewModel.authProviderLabel != "Not Connected" {
                        Button("Disconnect Account", role: .destructive) {
                            viewModel.disconnectAccount()
                        }
                    }
                }

                Section("Developer API") {
                    if viewModel.isPaidTier {
                        Picker("Target", selection: $viewModel.selectedDeveloperTarget) {
                            ForEach(viewModel.developerTargets, id: \.self) { target in
                                Text(target).tag(target)
                            }
                        }

                        if viewModel.developerAPIKey.isEmpty {
                            Button("Generate API Key") {
                                viewModel.generateDeveloperAPIKey()
                            }
                        } else {
                            Text(viewModel.developerAPIKey)
                                .font(.system(.footnote, design: .monospaced))
                                .textSelection(.enabled)

                            Button("Copy API Key") {
                                viewModel.copyToClipboard(viewModel.developerAPIKey, label: "API key")
                            }

                            Button("Copy \(viewModel.selectedDeveloperTarget) Snippet") {
                                viewModel.copyToClipboard(viewModel.developerAPISnippet, label: "API snippet")
                            }

                            Button("Revoke API Key", role: .destructive) {
                                viewModel.revokeDeveloperAPIKey()
                            }
                        }
                    } else {
                        Text("Developer API key generation is available on PRO and CLOUD monthly plans.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)

                        Button("Upgrade to PRO") {
                            viewModel.showPlanSheet = true
                        }
                    }
                }

                Section("Cloud Backup") {
                    Text("CLOUD plan supports backup import from iCloud Drive / Google Drive and backup export through Files.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)

                    Button("Export Passwords Backup") {
                        if let document = viewModel.makeBackupDocument() {
                            exportDocument = document
                            exportFilename = makeExportFilename()
                            showExportPicker = true
                        }
                    }
                    .disabled(!viewModel.isPaidTier)

                    Button("Import from iCloud / Google Drive") {
                        if viewModel.hasCloudTools {
                            showImportPicker = true
                        } else {
                            viewModel.alertState = AlertState(message: "Upgrade to CLOUD to import backups from iCloud/Google Drive.")
                            viewModel.showPlanSheet = true
                        }
                    }

                    if !viewModel.isPaidTier {
                        Text("Export is available for paid users. Upgrade to PRO or CLOUD.")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(.secondary)
                    }
                }

                Section("Security") {
                    Toggle("Enable Passkey Unlock (Face ID / Passcode)", isOn: passkeyBinding)
                        .disabled(!viewModel.hasVault)

                    if !viewModel.hasVault {
                        Text("Create your vault first to enable passkey unlock.")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(.secondary)
                    }

                    Button("Lock Vault") {
                        viewModel.lockVault()
                    }

                    Button("Reset Local App", role: .destructive) {
                        viewModel.showResetPrompt = true
                    }
                }
            }
            .navigationTitle("Settings")
            .fileImporter(
                isPresented: $showImportPicker,
                allowedContentTypes: [.passgenBackup, .json]
            ) { result in
                switch result {
                case .success(let url):
                    let accessGranted = url.startAccessingSecurityScopedResource()
                    defer {
                        if accessGranted {
                            url.stopAccessingSecurityScopedResource()
                        }
                    }

                    do {
                        let data = try Data(contentsOf: url)
                        viewModel.importBackupData(data)
                    } catch {
                        viewModel.alertState = AlertState(message: "Unable to read selected backup file.")
                    }
                case .failure(let error):
                    viewModel.alertState = AlertState(message: "Import cancelled: \(error.localizedDescription)")
                }
            }
            .fileExporter(
                isPresented: $showExportPicker,
                document: exportDocument,
                contentType: .passgenBackup,
                defaultFilename: exportFilename
            ) { result in
                switch result {
                case .success:
                    viewModel.alertState = AlertState(message: "Backup exported successfully.")
                case .failure(let error):
                    viewModel.alertState = AlertState(message: "Export failed: \(error.localizedDescription)")
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}

private struct NativeEntryEditorView: View {
    @ObservedObject var viewModel: NativeVaultViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showPassword = false

    private var entryTitle: String {
        viewModel.draft.id == nil ? "Add Website" : "Edit Website"
    }

    private var selectedDomain: String? {
        normalizedDomain(from: viewModel.draft.url) ?? viewModel.draft.websiteDomain
    }

    private var selectedDescription: String {
        let directDescription = (viewModel.draft.websiteDescription ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !directDescription.isEmpty {
            return directDescription
        }

        if let presetID = viewModel.draft.websitePresetId,
           let preset = websitePresets.first(where: { $0.id == presetID }) {
            return preset.description
        }

        return ""
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Button {
                        viewModel.openWebsitePicker()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "globe")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                            Text(viewModel.draft.websitePresetId == nil ? "Add Website" : "Change Website")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                if viewModel.draft.websitePresetId != nil || !selectedDescription.isEmpty || selectedDomain != nil {
                    Section("Account Name") {
                        HStack(spacing: 12) {
                            WebsiteBrandIconView(
                                domain: selectedDomain,
                                title: viewModel.selectedWebsiteName,
                                size: 40
                            )
                            Text(viewModel.selectedWebsiteName)
                                .font(.system(size: 18, weight: .bold))
                        }

                        TextField("Account name", text: $viewModel.draft.name)
                    }
                } else {
                    Section("Account Name") {
                        TextField("Account name", text: $viewModel.draft.name)
                    }
                }

                if !selectedDescription.isEmpty {
                    Section("Description") {
                        Text(selectedDescription)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(red: 24 / 255, green: 28 / 255, blue: 48 / 255))
                    }
                }

                Section("Credentials") {
                    TextField("Username", text: $viewModel.draft.username)

                    HStack(spacing: 10) {
                        Group {
                            if showPassword {
                                TextField("Password", text: $viewModel.draft.password)
                            } else {
                                SecureField("Password", text: $viewModel.draft.password)
                            }
                        }
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(.secondary)
                        }

                        Button {
                            viewModel.draft.password = viewModel.generatePassword()
                        } label: {
                            Image(systemName: "key.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
                        }
                    }
                }

                Section("Website URL") {
                    TextField("URL", text: $viewModel.draft.url)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                }

                Section("Notes") {
                    TextEditor(text: $viewModel.draft.notes)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle(entryTitle)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        if viewModel.saveDraftEntry() {
                            dismiss()
                        }
                    }
                    .font(.system(size: 17, weight: .bold))
                }
            }
        }
        .navigationViewStyle(.stack)
        .sheet(isPresented: $viewModel.showWebsitePicker) {
            NativeWebsitePickerView(viewModel: viewModel)
        }
    }
}

private struct NativeWebsitePickerView: View {
    @ObservedObject var viewModel: NativeVaultViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var searchFocused: Bool

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14)
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundColor(.secondary)
                        TextField("Search 300+ websites", text: $viewModel.websiteQuery)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled(true)
                            .focused($searchFocused)
                    }
                    .padding(12)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(16)

                    Text("Popular Websites:")
                        .font(.system(size: 18, weight: .semibold))

                    if viewModel.filteredWebsitePresets.isEmpty {
                        Text("No websites found for your search.")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.secondary)
                    } else {
                        LazyVGrid(columns: columns, spacing: 18) {
                            ForEach(viewModel.filteredWebsitePresets) { preset in
                                Button {
                                    viewModel.applyWebsitePreset(preset)
                                    dismiss()
                                } label: {
                                    VStack(spacing: 8) {
                                        WebsiteBrandIconView(domain: preset.domain, title: preset.name, size: 54)
                                        Text(preset.name)
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(.primary)
                                            .multilineTextAlignment(.center)
                                            .lineLimit(2)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Add Website")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .padding(10)
                            .background(Circle().fill(Color(UIColor.secondarySystemBackground)))
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                searchFocused = true
            }
        }
    }
}

private struct WebsiteBrandIconView: View {
    let domain: String?
    let title: String
    let size: CGFloat

    private var primaryURL: URL? {
        guard let domain, !domain.isEmpty else { return nil }
        return URL(string: "https://logo.clearbit.com/\(domain)?size=128")
    }

    private var fallbackURL: URL? {
        guard let domain, !domain.isEmpty else { return nil }
        return URL(string: "https://icons.duckduckgo.com/ip3/\(domain).ico")
    }

    private var tertiaryURL: URL? {
        guard let domain, !domain.isEmpty else { return nil }
        return URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=128")
    }

    var body: some View {
        ZStack {
            if let primaryURL {
                AsyncImage(url: primaryURL) { primaryPhase in
                    switch primaryPhase {
                    case .success(let image):
                        iconImage(image)
                    case .empty:
                        ProgressView()
                            .scaleEffect(0.7)
                    case .failure:
                        fallbackContent
                    @unknown default:
                        fallbackContent
                    }
                }
            } else {
                fallbackContent
            }
        }
        .frame(width: size, height: size)
        .background(Circle().fill(Color.white))
        .overlay(Circle().stroke(Color.black.opacity(0.06), lineWidth: 0.6))
        .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private var fallbackContent: some View {
        if let fallbackURL {
            AsyncImage(url: fallbackURL) { fallbackPhase in
                switch fallbackPhase {
                case .success(let image):
                    iconImage(image)
                default:
                    tertiaryContent
                }
            }
        } else {
            tertiaryContent
        }
    }

    @ViewBuilder
    private var tertiaryContent: some View {
        if let tertiaryURL {
            AsyncImage(url: tertiaryURL) { tertiaryPhase in
                switch tertiaryPhase {
                case .success(let image):
                    iconImage(image)
                default:
                    fallbackInitial
                }
            }
        } else {
            fallbackInitial
        }
    }

    private var fallbackInitial: some View {
        Text(String(title.prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundColor(Color(red: 62 / 255, green: 78 / 255, blue: 184 / 255))
    }

    private func iconImage(_ image: Image) -> some View {
        image
            .resizable()
            .scaledToFit()
            .clipShape(Circle())
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
