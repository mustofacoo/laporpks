// config.js - Konfigurasi utama aplikasi PKS Jember
const AppConfig = {
    // Konfigurasi Supabase
    supabase: {
        // PENTING: Ganti dengan URL dan key Supabase project Anda yang sebenarnya
        // Format URL: https://xxxxxxxxxxxxxxxxx.supabase.co
        url: 'https://jfgyizjkbqaklcucuorm.supabase.co',
        // Format Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZ3lpemprYnFha2xjdWN1b3JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDIyNDEsImV4cCI6MjA3MTg3ODI0MX0.04LDu4DIZUIN20JdT8wc84rAjYYqOtOdL9VQTiGzqu4',
        
        // Connection settings
        options: {
            auth: {
                autoRefreshToken: true,
                persistSession: false,
                detectSessionInUrl: false
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            },
            global: {
                headers: {
                    'x-application-name': 'pks-jember-complaint-system',
                }
            }
        }
    },

    // Konfigurasi Admin
    admin: {
        useSupabaseAuth: false, // Set true untuk produksi
        sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        
        // Fallback credentials untuk development/testing
        fallbackCredentials: {
            username: 'admin',
            password: 'pksjember2024'
        }
    },

    // Konfigurasi Real-time
    realtime: {
        enabled: true,
        channel: 'complaints-channel',
        retryInterval: 5000, // 5 seconds
        maxRetries: 3,
        enablePresence: false
    },

    // Database configuration
    database: {
        timeout: 30000, // 30 seconds
        maxRows: 1000,
        defaultOrderBy: 'created_at DESC'
    },

    // Validation rules
    validation: {
        phone: {
            pattern: /^08[0-9]{8,12}$/,
            message: 'Nomor HP harus dalam format 08xxxxxxxxx'
        },
        name: {
            minLength: 3,
            maxLength: 100,
            message: 'Nama harus antara 3-100 karakter'
        },
        complaint: {
            minLength: 20,
            maxLength: 2000,
            message: 'Isi aduan harus antara 20-2000 karakter'
        }
    },

    // Categories
    categories: [
        { value: 'Infrastruktur', label: 'Infrastruktur', color: '#3B82F6' },
        { value: 'Pelayanan Publik', label: 'Pelayanan Publik', color: '#10B981' },
        { value: 'Sosial', label: 'Sosial', color: '#8B5CF6' },
        { value: 'Kesehatan', label: 'Kesehatan', color: '#EF4444' },
        { value: 'Pendidikan', label: 'Pendidikan', color: '#F59E0B' },
        { value: 'Ekonomi', label: 'Ekonomi', color: '#6366F1' },
        { value: 'Lingkungan', label: 'Lingkungan', color: '#059669' },
        { value: 'Keamanan', label: 'Keamanan', color: '#DC2626' },
        { value: 'Lainnya', label: 'Lainnya', color: '#6B7280' }
    ],

    // Status configuration
    complaintStatus: [
        { value: 'pending', label: 'Menunggu', color: '#F59E0B', bgColor: '#FEF3C7' },
        { value: 'in_progress', label: 'Diproses', color: '#3B82F6', bgColor: '#DBEAFE' },
        { value: 'completed', label: 'Selesai', color: '#10B981', bgColor: '#D1FAE5' },
        { value: 'rejected', label: 'Ditolak', color: '#EF4444', bgColor: '#FEE2E2' }
    ],

    // UI configuration
    ui: {
        theme: {
            primaryColor: '#ff6b35',
            secondaryColor: '#ea580c',
            backgroundColor: '#f9fafb'
        },
        notifications: {
            duration: 5000,
            position: 'top-right'
        },
        table: {
            itemsPerPage: 25,
            autoRefresh: true,
            autoRefreshInterval: 30000
        }
    },

    // Debug settings
    debug: {
        enabled: true,
        logLevel: 'debug',
        showConnectionStatus: true
    },

    // Feature flags
    features: {
        enableRealTime: true,
        enableExport: true,
        enableSearch: true
    }
};

// Enhanced logging utility
window.AppLogger = {
    error: (...args) => {
        if (AppConfig.debug.enabled) {
            console.error('[PKS App Error]', new Date().toISOString(), ...args);
        }
    },
    warn: (...args) => {
        if (AppConfig.debug.enabled) {
            console.warn('[PKS App Warn]', new Date().toISOString(), ...args);
        }
    },
    info: (...args) => {
        if (AppConfig.debug.enabled) {
            console.info('[PKS App Info]', new Date().toISOString(), ...args);
        }
    },
    debug: (...args) => {
        if (AppConfig.debug.enabled && AppConfig.debug.logLevel === 'debug') {
            console.debug('[PKS App Debug]', new Date().toISOString(), ...args);
        }
    }
};

// Configuration validation
function validateConfig() {
    const errors = [];
    
    if (!AppConfig.supabase.url || AppConfig.supabase.url === 'YOUR_SUPABASE_PROJECT_URL') {
        errors.push('Supabase URL belum dikonfigurasi dengan benar');
    }
    
    if (!AppConfig.supabase.anonKey || AppConfig.supabase.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
        errors.push('Supabase anonymous key belum dikonfigurasi dengan benar');
    }
    
    if (errors.length > 0) {
        window.AppLogger?.error('Configuration errors:', errors);
        return { valid: false, errors };
    }
    
    return { valid: true, errors: [] };
}

// Export to global scope
window.AppConfig = AppConfig;
window.validateConfig = validateConfig;

// Config accessor helper
window.getConfig = function(path, defaultValue = null) {
    try {
        const keys = path.split('.');
        let current = AppConfig;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    } catch (error) {
        window.AppLogger?.error('Error accessing config:', path, error);
        return defaultValue;
    }
};

// Initialize configuration
document.addEventListener('DOMContentLoaded', function() {
    const validation = validateConfig();
    
    if (!validation.valid && AppConfig.debug.enabled) {
        console.warn('⚠️ Configuration issues detected:', validation.errors);
        
        // Show warning for development
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            background: #fbbf24; color: #92400e; padding: 10px; text-align: center;
            font-weight: bold; border-bottom: 2px solid #f59e0b;
        `;
        warningDiv.innerHTML = `
            ⚠️ Konfigurasi belum lengkap: ${validation.errors.join(', ')}
            <button onclick="this.parentNode.remove()" style="margin-left: 10px; background: #92400e; color: white; border: none; padding: 2px 8px; border-radius: 3px;">Tutup</button>
        `;
        document.body.insertBefore(warningDiv, document.body.firstChild);
    }
});