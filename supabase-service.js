// supabase-service.js - Enhanced Supabase service with proper error handling
class SupabaseService {
    constructor() {
        this.supabase = null;
        this.initialized = false;
        this.connectionStatus = 'disconnected';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.subscribers = new Map();
        this.rateLimiter = new Map();
    }

    // Initialize Supabase connection
    async init() {
        try {
            this.connectionStatus = 'connecting';
            
            // Check if AppConfig is available
            if (!window.AppConfig) {
                throw new Error('AppConfig tidak tersedia. Pastikan config.js sudah dimuat.');
            }

            const config = window.AppConfig.supabase;
            
            // Validate configuration
            if (!config.url || config.url === 'YOUR_SUPABASE_PROJECT_URL') {
                throw new Error('Supabase URL belum dikonfigurasi. Ganti YOUR_SUPABASE_PROJECT_URL dengan URL project Anda.');
            }
            
            if (!config.anonKey || config.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
                throw new Error('Supabase anon key belum dikonfigurasi. Ganti YOUR_SUPABASE_ANON_KEY dengan key Anda.');
            }

            // Ensure Supabase SDK is loaded
            if (!window.supabase) {
                throw new Error('Supabase SDK belum dimuat. Periksa koneksi internet.');
            }

            // Create Supabase client
            this.supabase = window.supabase.createClient(
                config.url, 
                config.anonKey, 
                config.options || {}
            );
            
            // Test connection
            await this.testConnection();
            
            this.initialized = true;
            this.connectionStatus = 'connected';
            this.retryCount = 0;
            
            window.AppLogger?.info('Supabase terhubung sukses');
            this.dispatchConnectionEvent('connected');
            
            return true;
            
        } catch (error) {
            this.connectionStatus = 'error';
            this.initialized = false;
            
            window.AppLogger?.error('Gagal menginisialisasi Supabase:', error.message);
            this.dispatchConnectionEvent('error', error);
            
            return false;
        }
    }

    // Test database connection
    async testConnection() {
        if (!this.supabase) {
            throw new Error('Supabase client belum diinisialisasi');
        }

        try {
            // Simple test query
            const { data, error } = await this.supabase
                .from('complaints')
                .select('id')
                .limit(1);

            // It's ok if table doesn't exist yet (for fresh setup)
            if (error && !error.message.includes('relation "complaints" does not exist')) {
                throw error;
            }

            return { success: true };
        } catch (error) {
            throw new Error(`Tes koneksi gagal: ${error.message}`);
        }
    }

    // Dispatch connection events
    dispatchConnectionEvent(status, error = null) {
        window.dispatchEvent(new CustomEvent('supabaseConnectionChange', {
            detail: { status, error, timestamp: Date.now() }
        }));
    }

    // Simple rate limiting
    checkRateLimit(operation, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const key = `${operation}_${Math.floor(now / windowMs)}`;
        
        const count = this.rateLimiter.get(key) || 0;
        if (count >= limit) {
            throw new Error(`Terlalu banyak permintaan untuk ${operation}. Coba lagi nanti.`);
        }
        
        this.rateLimiter.set(key, count + 1);
        
        // Cleanup old entries
        setTimeout(() => {
            for (const [k] of this.rateLimiter.entries()) {
                const keyTime = parseInt(k.split('_').pop()) * windowMs;
                if (now - keyTime > windowMs) {
                    this.rateLimiter.delete(k);
                }
            }
        }, windowMs);
    }

    // Enhanced error handler
    handleError(error, operation) {
        window.AppLogger?.error(`Supabase ${operation} error:`, error);

        // Handle specific error types
        if (error.message?.includes('JWT')) {
            return { success: false, error: 'Sesi berakhir. Silakan refresh halaman.' };
        }
        
        if (error.message?.includes('connection')) {
            return { success: false, error: 'Masalah koneksi. Periksa koneksi internet Anda.' };
        }

        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            return { success: false, error: 'Tabel database belum dibuat. Jalankan SQL schema terlebih dahulu.' };
        }

        return { 
            success: false, 
            error: window.AppConfig?.debug?.enabled ? error.message : 'Terjadi kesalahan. Silakan coba lagi.' 
        };
    }

    // Retry wrapper for operations
    async executeWithRetry(operation, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                window.AppLogger?.warn(`Mencoba ulang operasi, percobaan ${attempt + 1}/${maxRetries}`);
            }
        }
    }

    // =============================================
    // COMPLAINT OPERATIONS
    // =============================================

    async createComplaint(complaintData) {
        if (!this.initialized) {
            const initialized = await this.init();
            if (!initialized) {
                return { success: false, error: 'Koneksi database gagal' };
            }
        }

        try {
            this.checkRateLimit('createComplaint', 5); // Max 5 per minute

            // Validate required fields
            const required = ['nama', 'nomorHp', 'kecamatan', 'desa', 'alamat', 'kategori', 'isiAduan'];
            for (const field of required) {
                if (!complaintData[field]?.toString().trim()) {
                    throw new Error(`Field ${field} wajib diisi`);
                }
            }

            // Format phone number
            const phoneNumber = this.formatPhoneNumber(complaintData.nomorHp);
            if (!phoneNumber.match(/^08[0-9]{8,12}$/)) {
                throw new Error('Format nomor HP tidak valid. Gunakan format 08xxxxxxxxx');
            }

            // Prepare data
            const sanitizedData = {
                nama: complaintData.nama.trim(),
                nomor_hp: phoneNumber,
                kecamatan: complaintData.kecamatan.trim(),
                desa: complaintData.desa.trim(),
                alamat: complaintData.alamat.trim(),
                kategori: complaintData.kategori.trim(),
                isi_aduan: complaintData.isiAduan.trim(),
                status: 'pending',
                created_at: new Date().toISOString()
            };

            const result = await this.executeWithRetry(async () => {
                const { data, error } = await this.supabase
                    .from('complaints')
                    .insert([sanitizedData])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            });

            window.AppLogger?.info('Complaint created:', result.id);
            return { success: true, data: result };

        } catch (error) {
            return this.handleError(error, 'createComplaint');
        }
    }

    async getAllComplaints(options = {}) {
        if (!this.initialized) {
            const initialized = await this.init();
            if (!initialized) {
                return { success: false, error: 'Koneksi database gagal', data: [] };
            }
        }

        try {
            const { limit = 100, orderBy = 'created_at', ascending = false } = options;

            const result = await this.executeWithRetry(async () => {
                const { data, error } = await this.supabase
                    .from('complaints')
                    .select('*')
                    .order(orderBy, { ascending })
                    .limit(limit);

                if (error) throw error;
                return data || [];
            });

            return { success: true, data: result };

        } catch (error) {
            return { ...this.handleError(error, 'getAllComplaints'), data: [] };
        }
    }

    async updateComplaintStatus(id, status, notes = null) {
        if (!this.initialized) {
            const initialized = await this.init();
            if (!initialized) {
                return { success: false, error: 'Koneksi database gagal' };
            }
        }

        try {
            const validStatuses = ['pending', 'in_progress', 'completed', 'rejected'];
            if (!validStatuses.includes(status)) {
                throw new Error('Status tidak valid');
            }

            const updateData = {
                status,
                updated_at: new Date().toISOString()
            };

            if (notes) {
                updateData.resolution_notes = notes.trim();
            }

            if (status === 'completed') {
                updateData.actual_completion = new Date().toISOString();
            }

            const result = await this.executeWithRetry(async () => {
                const { data, error } = await this.supabase
                    .from('complaints')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            });

            window.AppLogger?.info('Status updated:', id, status);
            return { success: true, data: result };

        } catch (error) {
            return this.handleError(error, 'updateComplaintStatus');
        }
    }

    // =============================================
    // REAL-TIME SUBSCRIPTIONS
    // =============================================

    subscribeToComplaints(callback) {
        if (!this.initialized || !window.AppConfig?.realtime?.enabled) {
            window.AppLogger?.warn('Real-time subscriptions tidak tersedia');
            return null;
        }

        try {
            const channelName = `complaints-${Date.now()}`;
            
            const subscription = this.supabase
                .channel(channelName)
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'complaints'
                    }, 
                    (payload) => {
                        window.AppLogger?.debug('Real-time update:', payload);
                        if (callback && typeof callback === 'function') {
                            callback(payload);
                        }
                    }
                )
                .subscribe((status) => {
                    window.AppLogger?.info('Subscription status:', status);
                });

            this.subscribers.set(channelName, subscription);
            return subscription;

        } catch (error) {
            window.AppLogger?.error('Failed to create subscription:', error.message);
            return null;
        }
    }

    unsubscribe(subscription) {
        if (subscription && this.supabase) {
            try {
                this.supabase.removeChannel(subscription);
                
                // Remove from tracking
                for (const [key, value] of this.subscribers.entries()) {
                    if (value === subscription) {
                        this.subscribers.delete(key);
                        break;
                    }
                }
                
                window.AppLogger?.debug('Unsubscribed successfully');
            } catch (error) {
                window.AppLogger?.error('Error unsubscribing:', error.message);
            }
        }
    }

    // =============================================
    // UTILITY METHODS
    // =============================================

    formatPhoneNumber(phone) {
        if (!phone) return phone;
        
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        
        // Convert to standard Indonesian format (08xxxxxxxxx)
        if (cleaned.startsWith('62')) {
            return '0' + cleaned.substring(2);
        } else if (cleaned.startsWith('8')) {
            return '0' + cleaned;
        }
        
        return cleaned;
    }

    // Get connection status
    getConnectionStatus() {
        return {
            status: this.connectionStatus,
            initialized: this.initialized,
            retryCount: this.retryCount,
            timestamp: Date.now()
        };
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.initialized) {
                return { healthy: false, error: 'Not initialized' };
            }

            await this.testConnection();
            
            return { 
                healthy: true, 
                status: this.connectionStatus,
                timestamp: Date.now() 
            };
            
        } catch (error) {
            return { 
                healthy: false, 
                error: error.message,
                status: this.connectionStatus,
                timestamp: Date.now() 
            };
        }
    }

    // Cleanup method
    destroy() {
        // Unsubscribe from all channels
        for (const subscription of this.subscribers.values()) {
            this.unsubscribe(subscription);
        }
        
        this.subscribers.clear();
        this.rateLimiter.clear();
        this.initialized = false;
        this.connectionStatus = 'disconnected';
        
        window.AppLogger?.info('SupabaseService destroyed');
    }
}

// Create and export singleton instance
window.supabaseService = new SupabaseService();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.supabaseService?.destroy();
});

// Network status monitoring
window.addEventListener('online', async () => {
    if (window.supabaseService && !window.supabaseService.initialized) {
        window.AppLogger?.info('Network back online, attempting to reconnect...');
        await window.supabaseService.init();
    }
});

window.addEventListener('offline', () => {
    window.AppLogger?.warn('Network offline, switching to offline mode');
});

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseService;
}

/*
INTEGRATION NOTES:

1. Pastikan file config.js dimuat sebelum file ini
2. Update URL dan anon key di config.js
3. Jalankan SQL schema di Supabase terlebih dahulu
4. File ini akan otomatis diinisialisasi saat halaman dimuat
5. Gunakan window.supabaseService untuk mengakses service
6. Semua method mengembalikan format { success: boolean, data?: any, error?: string }

EXAMPLE USAGE:
const result = await window.supabaseService.createComplaint(formData);
if (result.success) {
    console.log('Complaint created:', result.data);
} else {
    console.error('Error:', result.error);
}
*/