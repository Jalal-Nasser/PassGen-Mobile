import React, { createContext, useContext, useEffect, useState } from 'react'

export type Language = 'en' | 'ar'

const STORAGE_KEY = 'passgen-language'

const translations: Record<Language, Record<string, string>> = {
  en: {},
  ar: {
    'Language': 'اللغة',
    'English': 'الإنجليزية',
    'Arabic': 'العربية',
    'Reset App': 'إعادة ضبط التطبيق',
    'Clear local data and restart wizard': 'مسح البيانات المحلية وإعادة تشغيل المعالج',
    'Clear local data and restart the setup wizard. Continue?': 'سيؤدي هذا إلى مسح البيانات المحلية وإعادة تشغيل معالج الإعداد. هل تريد المتابعة؟',
    'Master password must be at least 8 characters': 'يجب أن تكون كلمة المرور الرئيسية مكونة من 8 أحرف على الأقل',
    'Failed to configure storage: {{message}}': 'فشل إعداد التخزين: {{message}}',
    'Enter your master password': 'أدخل كلمة المرور الرئيسية',
    'Set a new master password': 'عيّن كلمة مرور رئيسية جديدة',
    'Master Password (min 8 characters)': 'كلمة المرور الرئيسية (حد أدنى 8 أحرف)',
    'Create Master Password (min 8 characters)': 'إنشاء كلمة مرور رئيسية (حد أدنى 8 أحرف)',
    'Hide password': 'إخفاء كلمة المرور',
    'Show password': 'إظهار كلمة المرور',
    'Password hint (optional)': 'تلميح كلمة المرور (اختياري)',
    'Hint: {{hint}}': 'تلميح: {{hint}}',
    'Unlock Vault': 'فتح الخزنة',
    'Set Master Password': 'تعيين كلمة المرور الرئيسية',
    'Unlock with Passkey': 'فتح عبر مفتاح المرور',
    "Master password unlocks your vault. Don't forget it.": 'كلمة المرور الرئيسية تفتح خزنتك. لا تنسها.',
    'Incorrect master password. Please try again.': 'كلمة المرور الرئيسية غير صحيحة. حاول مرة أخرى.',
    'Passkey is not supported on this device': 'مفتاح المرور غير مدعوم على هذا الجهاز',
    'Passkey requires a secure context. Please use your master password.': 'يتطلب مفتاح المرور سياقًا آمنًا. يرجى استخدام كلمة المرور الرئيسية.',
    'No passkey found. Please use your master password.': 'لم يتم العثور على مفتاح مرور. يرجى استخدام كلمة المرور الرئيسية.',
    'Passkey verification cancelled': 'تم إلغاء التحقق من مفتاح المرور',
    'Passkey verified! Now please enter your master password to unlock the vault.': 'تم التحقق من مفتاح المرور! الآن أدخل كلمة المرور الرئيسية لفتح الخزنة.',
    'Passkey does not match. Please use your master password.': 'مفتاح المرور غير مطابق. يرجى استخدام كلمة المرور الرئيسية.',
    'Passkey verification cancelled.': 'تم إلغاء التحقق من مفتاح المرور.',
    'Passkey verification failed: {{message}}': 'فشل التحقق من مفتاح المرور: {{message}}',
    'Please select at least one character type': 'يرجى اختيار نوع واحد على الأقل من الأحرف',
    'Vault': 'الخزنة',
    'Generator': 'المولّد',
    'Free plan: 4 passwords. Upgrade to unlock unlimited entries and sync.': 'الخطة المجانية: 4 كلمات مرور. قم بالترقية لفتح عدد غير محدود والمزامنة.',
    'Upgrade': 'ترقية',
    'Generate Secure Passwords': 'إنشاء كلمات مرور آمنة',
    'Click generate to create password': 'اضغط إنشاء لتوليد كلمة مرور',
    'Copy': 'نسخ',
    'Copied!': 'تم النسخ!',
    'Password Length': 'طول كلمة المرور',
    'Uppercase Letters (A-Z)': 'أحرف كبيرة (A-Z)',
    'Lowercase Letters (a-z)': 'أحرف صغيرة (a-z)',
    'Numbers (0-9)': 'أرقام (0-9)',
    'Symbols (!@#$...)': 'رموز (!@#$...)',
    'Generate Password': 'إنشاء كلمة مرور',
    'Secure Password Manager': 'مدير كلمات مرور آمن',
    'File': 'ملف',
    'View': 'عرض',
    'Help': 'مساعدة',
    'Open Vault Backup': 'فتح نسخة احتياطية للخزنة',
    'Save Vault Backup': 'حفظ نسخة احتياطية للخزنة',
    'Settings': 'الإعدادات',
    'Premium Access': 'دخول بريميوم',
    'Exit': 'خروج',
    'Reload': 'إعادة تحميل',
    'Toggle DevTools': 'أدوات المطور',
    'Actual Size': 'الحجم الفعلي',
    'Zoom In': 'تكبير',
    'Zoom Out': 'تصغير',
    'Documentation': 'الوثائق',
    'Keyboard Shortcuts': 'اختصارات لوحة المفاتيح',
    'About PassGen': 'حول PassGen',
    'GitHub Releases': 'إصدارات GitHub',
    'Minimize': 'تصغير',
    'Maximize': 'تكبير',
    'Close': 'إغلاق',
    'Welcome to PassGen!': 'مرحبًا بك في PassGen!',
    'Your secure password manager and generator': 'مدير ومولّد كلمات مرور آمن',
    'Generate Strong Passwords': 'توليد كلمات مرور قوية',
    'Create secure, random passwords with customizable options': 'أنشئ كلمات مرور عشوائية وآمنة بخيارات قابلة للتخصيص',
    'Cloud Sync': 'مزامنة سحابية',
    'Store encrypted vaults in Google Drive or S3-compatible storage': 'خزّن الخزنات المشفرة في Google Drive أو تخزين متوافق مع S3',
    'Military-Grade Encryption': 'تشفير بمستوى عسكري',
    'All passwords encrypted with AES-256 before storage': 'تُشفّر جميع كلمات المرور بـ AES-256 قبل التخزين',
    'Zero-Knowledge': 'صفر معرفة',
    'Only you can decrypt your passwords. We never see them.': 'أنت وحدك من يستطيع فك التشفير. نحن لا نراها أبدًا.',
    'Search & Organize': 'بحث وتنظيم',
    'Quickly find passwords by name, username, or URL': 'اعثر بسرعة على كلمات المرور بالاسم أو اسم المستخدم أو الرابط',
    'Own Your Storage': 'امتلك تخزينك',
    'Store your passwords on your own storage. Never shared anywhere else.': 'خزّن كلمات المرور على تخزينك الخاص. لا تتم مشاركتها في أي مكان آخر.',
    'How It Works': 'كيف يعمل',
    'Your privacy and security, explained': 'خصوصيتك وأمانك، بشرح مبسّط',
    'Choose Storage': 'اختر التخزين',
    'Select where to store your encrypted passwords:': 'اختر مكان تخزين كلمات المرور المشفّرة:',
    'Local': 'محلي',
    'Only on your device': 'على جهازك فقط',
    'Sync across devices': 'مزامنة عبر الأجهزة',
    'S3-Compatible': 'متوافق مع S3',
    'AWS, R2, Wasabi, Spaces, MinIO': 'AWS وR2 وWasabi وSpaces وMinIO',
    'Dropbox/OneDrive': 'Dropbox/OneDrive',
    'Coming soon': 'قريبًا',
    'Create a strong master password that encrypts all your data.': 'أنشئ كلمة مرور رئيسية قوية تشفّر جميع بياناتك.',
    'Important:': 'مهم:',
    'This password cannot be recovered! Make it memorable and keep it safe.': 'لا يمكن استعادة هذه الكلمة! اجعلها سهلة التذكر واحفظها بأمان.',
    'Start Using': 'ابدأ الاستخدام',
    'Generate passwords, save them securely, and access them anytime.': 'ولّد كلمات المرور، واحفظها بأمان، وادخل إليها في أي وقت.',
    'Everything is encrypted on your device before going to the cloud.': 'كل شيء يُشفّر على جهازك قبل الإرسال إلى السحابة.',
    'Quick Setup Tips': 'نصائح إعداد سريعة',
    'Get the most out of PassGen': 'استفد بأقصى قدر من PassGen',
    'Master Password Best Practices': 'أفضل ممارسات كلمة المرور الرئيسية',
    'Use at least 12-16 characters': 'استخدم 12-16 حرفًا على الأقل',
    'Mix uppercase, lowercase, numbers, and symbols': 'امزج بين الأحرف الكبيرة والصغيرة والأرقام والرموز',
    'Make it memorable but unique': 'اجعلها سهلة التذكر ولكن فريدة',
    'Consider using a passphrase (e.g., "Coffee&Music@Dawn2025!")': 'فكّر في استخدام عبارة مرور (مثل: "Coffee&Music@Dawn2025!")',
    'Cloud Storage Credentials': 'بيانات اعتماد التخزين السحابي',
    'For Google Drive: Connect once in-app to authorize access': 'لـ Google Drive: اتصل مرة واحدة داخل التطبيق لمنح الإذن',
    'For S3-compatible: Create access keys and a bucket': 'للتخزين المتوافق مع S3: أنشئ مفاتيح وصول وحاوية',
    'Supports AWS, DigitalOcean Spaces, Wasabi, Cloudflare R2, and MinIO': 'يدعم AWS وDigitalOcean Spaces وWasabi وCloudflare R2 وMinIO',
    'Or start with Local storage and add cloud sync later': 'أو ابدأ بالتخزين المحلي وأضف المزامنة السحابية لاحقًا',
    'Getting Started': 'البدء',
    "Start simple with local storage if you're unsure": 'ابدأ بالتخزين المحلي إن كنت غير متأكد',
    'You can always change storage providers later': 'يمكنك دائمًا تغيير مزود التخزين لاحقًا',
    'Your master password stays the same across providers': 'تبقى كلمة المرور الرئيسية نفسها عبر جميع المزودين',
    'Back': 'رجوع',
    'Next →': 'التالي →',
    "Let's Get Started! 🚀": 'لنبدأ! 🚀',
    'Step {{step}} of 3': 'الخطوة {{step}} من 3',
    'Configure Storage': 'تهيئة التخزين',
    'Choose where to store your encrypted vault': 'اختر مكان تخزين الخزنة المشفّرة',
    'Set up your storage provider': 'إعداد مزود التخزين',
    'New to PassGen?': 'جديد على PassGen؟',
    'Start with Local Storage and enable cloud sync later. You can change providers anytime.': 'ابدأ بالتخزين المحلي وفعّل المزامنة السحابية لاحقًا. يمكنك تغيير المزود في أي وقت.',
    'Local Storage': 'التخزين المحلي',
    'Default': 'افتراضي',
    'Store your encrypted vault on this device': 'خزّن خزنتك المشفّرة على هذا الجهاز',
    'Recommended': 'موصى به',
    'Encrypted sync/backup with your Google account': 'مزامنة/نسخ احتياطي مشفّر مع حساب Google',
    'S3-Compatible Storage': 'تخزين متوافق مع S3',
    'Advanced': 'متقدم',
    'Use AWS, R2, Wasabi, Spaces, MinIO, or custom endpoints': 'استخدم AWS أو R2 أو Wasabi أو Spaces أو MinIO أو نقاط نهاية مخصصة',
    'Dropbox': 'Dropbox',
    'Encrypted Dropbox backup (Tier B)': 'نسخ احتياطي مشفّر على Dropbox (الفئة B)',
    'OneDrive': 'OneDrive',
    'Encrypted OneDrive backup (Tier B)': 'نسخ احتياطي مشفّر على OneDrive (الفئة B)',
    'Continue': 'متابعة',
    'Vault Folder': 'مجلد الخزنة',
    'Choose a folder for your vault': 'اختر مجلدًا للخزنة',
    'Browse': 'استعراض',
    'Enable local version backups': 'تفعيل النسخ الاحتياطية للإصدارات المحلية',
    'Keep last N versions': 'الاحتفاظ بآخر N إصدارات',
    'Account': 'الحساب',
    'Not connected': 'غير متصل',
    'Click Connect to link your account': 'اضغط اتصال لربط حسابك',
    'This field is read-only. Use Connect to link your account.': 'هذا الحقل للقراءة فقط. استخدم اتصال لربط حسابك.',
    'Disconnect': 'قطع الاتصال',
    'Connect': 'اتصال',
    'Connecting...': 'جارٍ الاتصال...',
    'Continue with Google': 'متابعة باستخدام Google',
    'Signed in as {{email}}': 'تم تسجيل الدخول باسم {{email}}',
    'Already Premium?': 'هل أنت بريميوم بالفعل؟',
    'Sign in with Google to unlock cloud storage.': 'سجّل الدخول باستخدام Google لفتح التخزين السحابي.',
    'Become Premium': 'كن بريميوم',
    'Request activation after payment to unlock Premium.': 'اطلب التفعيل بعد الدفع لفتح بريميوم.',
    'Not signed in': 'غير مسجل الدخول',
    'Premium active': 'البريميوم مفعل',
    'Free plan': 'الخطة المجانية',
    'Plan: {{plan}}': 'الخطة: {{plan}}',
    'Sign out': 'تسجيل الخروج',
    'Step 1': 'الخطوة 1',
    'Step 2': 'الخطوة 2',
    'Step 3': 'الخطوة 3',
    'Connect Google Drive': 'ربط Google Drive',
    'Sign in to verify your plan and unlock cloud storage.': 'سجّل الدخول للتحقق من خطتك وفتح التخزين السحابي.',
    'Link Drive to store encrypted vault snapshots.': 'اربط Drive لتخزين لقطات خزنة مشفّرة.',
    'App account required to continue.': 'حساب التطبيق مطلوب للمتابعة.',
    'Upgrade to Premium to enable Google Drive.': 'قم بالترقية إلى بريميوم لتفعيل Google Drive.',
    'Drive connected: {{email}}': 'تم ربط Drive: {{email}}',
    'Drive not connected': 'Drive غير متصل',
    'Vault backend is not available': 'خادم الخزنة غير متاح',
    'Google Drive stores only encrypted vault snapshots. No plaintext ever leaves this device.': 'Google Drive يخزّن فقط لقطات خزنة مشفّرة. لا يغادر أي نص صريح هذا الجهاز.',
    'Endpoint (optional)': 'نقطة النهاية (اختياري)',
    'https://s3.amazonaws.com or custom endpoint': 'https://s3.amazonaws.com أو نقطة نهاية مخصصة',
    'Region': 'المنطقة',
    'Bucket': 'الحاوية',
    'Access Key ID': 'معرّف مفتاح الوصول',
    'Secret Access Key': 'مفتاح الوصول السري',
    'Path Prefix (optional)': 'بادئة المسار (اختياري)',
    'Test Connection': 'اختبار الاتصال',
    'Testing...': 'جارٍ الاختبار...',
    'Connection successful.': 'نجح الاتصال.',
    'Connection failed: {{message}}': 'فشل الاتصال: {{message}}',
    'Unknown error': 'خطأ غير معروف',
    'Please fill in all required fields first.': 'يرجى تعبئة جميع الحقول المطلوبة أولًا.',
    'Please complete all required S3 fields.': 'يرجى إكمال جميع حقول S3 المطلوبة.',
    'Connect your Google Drive account to continue.': 'قم بربط حساب Google Drive للمتابعة.',
    'Save': 'حفظ',
    'Password Vault': 'خزنة كلمات المرور',
    'Premium': 'بريميوم',
    'Generate': 'توليد',
    'Cancel': 'إلغاء',
    'Add New': 'إضافة جديد',
    'Actions': 'الإجراءات',
    'Refresh': 'تحديث',
    'Repair Vault': 'إصلاح الخزنة',
    'Change Storage': 'تغيير التخزين',
    'Setup Passkey': 'إعداد مفتاح المرور',
    'Export Vault Backup': 'تصدير نسخة احتياطية للخزنة',
    'Import Vault Backup': 'استيراد نسخة احتياطية للخزنة',
    'Export to CSV': 'تصدير إلى CSV',
    'Search passwords...': 'ابحث في كلمات المرور...',
    'Edit Password': 'تعديل كلمة المرور',
    'Add New Password': 'إضافة كلمة مرور جديدة',
    'Name *': 'الاسم *',
    'e.g., Gmail, Facebook': 'مثال: Gmail, Facebook',
    'Username/Email': 'اسم المستخدم/البريد',
    'Password *': 'كلمة المرور *',
    'Enter or generate password': 'أدخل أو ولّد كلمة مرور',
    'URL': 'الرابط',
    'Notes': 'ملاحظات',
    'Additional notes...': 'ملاحظات إضافية...',
    'Saving...': 'جارٍ الحفظ...',
    'Update Password': 'تحديث كلمة المرور',
    'Save Password': 'حفظ كلمة المرور',
    'Loading...': 'جارٍ التحميل...',
    'No passwords stored yet.': 'لا توجد كلمات مرور محفوظة بعد.',
    'Click "Add Password" to get started!': 'اضغط "إضافة كلمة مرور" للبدء!',
    'Edit': 'تعديل',
    'Collapse': 'طي',
    'Expand': 'توسيع',
    'Username': 'اسم المستخدم',
    'Copy username': 'نسخ اسم المستخدم',
    'Password': 'كلمة المرور',
    'Copy password': 'نسخ كلمة المرور',
    'Added {{date}}': 'أُضيف في {{date}}',
    'Storage Provider': 'مزود التخزين',
    'Extension Token': 'رمز الإضافة',
    'Copy session token': 'نسخ رمز الجلسة',
    'All passwords are encrypted with your master password': 'جميع كلمات المرور مشفّرة بكلمة مرورك الرئيسية',
    'Failed to load passwords: {{message}}': 'فشل تحميل كلمات المرور: {{message}}',
    'Repair will remove unreadable items and migrate any plaintext records to encrypted form. Continue?': 'سيؤدي الإصلاح إلى إزالة العناصر غير القابلة للقراءة وترحيل أي سجلات نصية إلى صيغة مشفّرة. هل تريد المتابعة؟',
    'Repair complete.\nTotal: {{total}}\nKept: {{kept}}\nMigrated: {{migrated}}\nRemoved: {{removed}}': 'اكتمل الإصلاح.\nالإجمالي: {{total}}\nالمحفوظ: {{kept}}\nالمُرحّل: {{migrated}}\nالمحذوف: {{removed}}',
    'Repair failed: {{message}}': 'فشل الإصلاح: {{message}}',
    'Export Vault Backup is a Premium feature. Upgrade to Premium to backup your vault.': 'تصدير النسخة الاحتياطية ميزة بريميوم. قم بالترقية لنسخ الخزنة احتياطيًا.',
    'Vault backup exported successfully!': 'تم تصدير النسخة الاحتياطية بنجاح!',
    'Export canceled or failed: {{message}}': 'تم إلغاء التصدير أو فشل: {{message}}',
    'Vault backup downloaded!': 'تم تنزيل النسخة الاحتياطية!',
    'Export failed: {{message}}': 'فشل التصدير: {{message}}',
    'Import Vault Backup is a Premium feature. Upgrade to Premium to restore backups.': 'استيراد النسخة الاحتياطية ميزة بريميوم. قم بالترقية لاستعادة النسخ.',
    'Importing will replace your current vault. Make sure you have a backup! Continue?': 'سيؤدي الاستيراد إلى استبدال خزنتك الحالية. تأكد من وجود نسخة احتياطية! هل تريد المتابعة؟',
    'Import canceled or failed: {{message}}': 'تم إلغاء الاستيراد أو فشل: {{message}}',
    'Vault imported successfully!': 'تم استيراد الخزنة بنجاح!',
    'Import failed: {{message}}': 'فشل الاستيراد: {{message}}',
    'No passwords to export': 'لا توجد كلمات مرور للتصدير',
    'Name and password are required': 'الاسم وكلمة المرور مطلوبان',
    'Password updated successfully!': 'تم تحديث كلمة المرور بنجاح!',
    'Password saved successfully!': 'تم حفظ كلمة المرور بنجاح!',
    'Failed to save password: {{message}}': 'فشل حفظ كلمة المرور: {{message}}',
    'Copied to clipboard': 'تم النسخ إلى الحافظة',
    'Failed to copy': 'فشل النسخ',
    'Failed to copy token': 'فشل نسخ الرمز',
    'Passkey is not supported on this device or browser': 'مفتاح المرور غير مدعوم على هذا الجهاز أو المتصفح',
    'Passkey requires a secure context. This feature is not available in this mode.': 'يتطلب مفتاح المرور سياقًا آمنًا. هذه الميزة غير متاحة في هذا الوضع.',
    'Passkey registration cancelled': 'تم إلغاء تسجيل مفتاح المرور',
    'Invalid credential type received': 'تم استلام نوع بيانات اعتماد غير صالح',
    'Passkey setup successful! You can now unlock with your biometric.': 'تم إعداد مفتاح المرور بنجاح! يمكنك الآن الفتح ببصمتك.',
    'Passkey setup cancelled': 'تم إلغاء إعداد مفتاح المرور',
    'Passkey setup failed: {{message}}': 'فشل إعداد مفتاح المرور: {{message}}',
    'Developer': 'المطور',
    'Blog': 'المدونة',
    'Terms': 'الشروط',
    'Check for Updates': 'التحقق من التحديثات',
    'Checking...': 'جارٍ التحقق...',
    'Premium member': 'عضو بريميوم',
    'Deployed by': 'مُستضاف بواسطة',
    'Free: 4 passwords': 'مجاني: 4 كلمات مرور',
    'Upgrade to Premium ($15 / 6 months)': 'الترقية إلى بريميوم ($15 / 6 أشهر)',
    'New version {{version}} available!': 'إصدار جديد {{version}} متاح!',
    'You have the latest version.': 'لديك أحدث إصدار.',
    'Update check failed: {{message}}': 'فشل التحقق من التحديثات: {{message}}',
    'Failed to fetch release info': 'فشل جلب معلومات الإصدار',
    'A new version ({{version}}) is available!\n\nGo to download page?': 'يتوفر إصدار جديد ({{version}})!\n\nهل تريد فتح صفحة التنزيل؟',
    'Terms of Service': 'شروط الخدمة',
    'Please read these basics before using PassGen.': 'يرجى قراءة هذه الأساسيات قبل استخدام PassGen.',
    'Zero-knowledge: Your master password never leaves your device.': 'صفر معرفة: كلمة مرورك الرئيسية لا تغادر جهازك.',
    'Local-first: Data is encrypted on-device before any storage.': 'أولوية محلية: تُشفّر البيانات على الجهاز قبل أي تخزين.',
    'Free plan: up to 4 password entries.': 'الخطة المجانية: حتى 4 إدخالات.',
    'Premium plan: unlimited entries and cloud providers.': 'خطة بريميوم: إدخالات غير محدودة ومزودو سحابة.',
    'You are responsible for keeping your master password safe. It cannot be recovered.': 'أنت مسؤول عن الحفاظ على كلمة المرور الرئيسية. لا يمكن استعادتها.',
    'You are already a Premium user!': 'أنت مستخدم بريميوم بالفعل!',
    'Enjoy unlimited passwords and cloud sync.': 'استمتع بكلمات مرور غير محدودة ومزامنة سحابية.',
    'Secure upgrade': 'ترقية آمنة',
    'Unlock Premium': 'افتح بريميوم',
    'Unlimited vault entries and cloud sync for {{price}}': 'إدخالات غير محدودة ومزامنة سحابية مقابل {{price}}',
    '6 months of sync + updates': '6 أشهر من المزامنة والتحديثات',
    'Pay using the QR that suits you': 'ادفع باستخدام رمز QR المناسب لك',
    'Scan the QR with your phone to complete payment.': 'امسح رمز QR بهاتفك لإتمام الدفع.',
    'Scan with your PayPal app': 'امسح باستخدام تطبيق PayPal',
    'Scan to pay': 'امسح للدفع',
    'Credit Card': 'بطاقة ائتمان',
    'Instant': 'فوري',
    'Scan with your phone to pay.': 'امسح بهاتفك للدفع.',
    'Send 15 USDT (BEP20)': 'أرسل 15 USDT (BEP20)',
    'Copy address': 'نسخ العنوان',
    'Request activation after payment': 'اطلب التفعيل بعد الدفع',
    'Share your email, then paste the code you get back to unlock Premium.': 'شارك بريدك الإلكتروني، ثم الصق الرمز الذي يصلك لفتح بريميوم.',
    'Install ID (for support)': 'معرّف التثبيت (للدعم)',
    'Payment Method': 'طريقة الدفع',
    'Crypto (USDT)': 'عملة رقمية (USDT)',
    'Your Email (for activation)': 'بريدك الإلكتروني (للتفعيل)',
    'Activation Code': 'رمز التفعيل',
    'Enter code from seller': 'أدخل الرمز من البائع',
    'Request Sent': 'تم إرسال الطلب',
    'Sending...': 'جارٍ الإرسال...',
    'Request Activation': 'طلب التفعيل',
    'Activate': 'تفعيل',
    'Test Verify (dev)': 'اختبار التحقق (تطوير)',
    'Generate Code (dev)': 'توليد رمز (تطوير)',
    'Seller Secret (dev only, stored locally)': 'السر الخاص بالبائع (تطوير فقط، محفوظ محليًا)',
    'override secret for testing': 'تعديل السر للاختبار',
    'Used to compute codes during development/testing without rebuild.': 'يُستخدم لحساب الرموز أثناء التطوير/الاختبار دون إعادة بناء.',
    'Activation request sent. You will be activated after verification.': 'تم إرسال طلب التفعيل. سيتم تفعيلك بعد التحقق.',
    'Activation pending. Please contact support if it does not update soon.': 'التفعيل معلق. يرجى التواصل مع الدعم إذا لم يتم التحديث قريبًا.',
    'Failed to send activation request.': 'فشل إرسال طلب التفعيل.',
    'Failed to send activation request: {{message}}': 'فشل إرسال طلب التفعيل: {{message}}',
    'Enter activation code': 'أدخل رمز التفعيل',
    'Enter your email first': 'أدخل بريدك الإلكتروني أولًا',
    'Premium activated. Enjoy!': 'تم تفعيل بريميوم. استمتع!',
    'Invalid activation code.': 'رمز التفعيل غير صحيح.',
    'Failed to copy Install ID': 'فشل نسخ معرّف التثبيت',
    'Failed to copy address': 'فشل نسخ العنوان',
    'Enter email and code': 'أدخل البريد والرمز',
    '✓ Code matches (dev test)': '✓ الرمز مطابق (اختبار)',
    '✗ Code does not match': '✗ الرمز غير مطابق',
    'Enter email first': 'أدخل البريد أولًا',
    '✓ Generated & copied: {{code}}': '✓ تم التوليد والنسخ: {{code}}',
    'Secret updated locally': 'تم تحديث السر محليًا'
  }
}

const normalizeLanguage = (value?: string | null): Language | null => {
  if (value === 'en' || value === 'ar') return value
  return null
}

const interpolate = (template: string, vars?: Record<string, string | number>) => {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = vars[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en'
  const stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY))
  if (stored) return stored
  const nav = window.navigator.language?.toLowerCase() || ''
  if (nav.startsWith('ar')) return 'ar'
  return 'en'
}

type I18nContextValue = {
  language: Language
  isRTL: boolean
  t: (text: string, vars?: Record<string, string | number>) => string
  setLanguage: (lang: Language) => void
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage())
  const isRTL = language === 'ar'

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = language
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.body.classList.toggle('rtl', isRTL)
  }, [language, isRTL])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
  }

  const t = (text: string, vars?: Record<string, string | number>) => {
    const template = translations[language]?.[text] ?? text
    return interpolate(template, vars)
  }

  return (
    <I18nContext.Provider value={{ language, isRTL, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
