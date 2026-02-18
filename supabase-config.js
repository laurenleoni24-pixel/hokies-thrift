// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://ytwombwhyemplzuxkzzv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0d29tYndoeWVtcGx6dXhrenp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzk0NTQsImV4cCI6MjA4Njg1NTQ1NH0.yQEBrsnxd3atRPXNAVB3HCrvILoT1-XyYHWdhEvASN8';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Re-assign so all code can use `supabase` as the client
window.supabase = supabaseClient;

// Image upload helper
async function uploadImage(bucket, file, path) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Convert base64 data URI to File object (for migration)
function base64ToFile(base64, filename) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

// Upload a File to Supabase Storage and return the public URL
async function uploadImageFile(bucket, file, folder) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    return await uploadImage(bucket, file, path);
}

// Compress an image file before upload (returns a File)
function compressImage(file, maxSize = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
