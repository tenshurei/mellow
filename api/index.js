const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Supabase Bağlantısı (Kendi bilgilerini çevre değişkenlerinden de alabilirsin)
const SUPABASE_URL = "https://cdkaqvbwlrflykogddbf.supabase.co";
const SUPABASE_KEY = "sb_publishable_o9G4Mp-j5o6rW1lqmju2xw_3eR5HTH4";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json()); // Frontend'den gelen JSON verilerini okumak için
app.use(cookieParser()); // Çerezleri okumak için

// OYUNCU GİRİŞ YAPMIŞ MI KONTROL EDEN SİSTEM (MIDDLEWARE)
const checkAuth = async (req, res, next) => {
    const token = req.cookies.mellow_token; // Çerezi oku
    if (!token) return res.redirect('/auth'); // Yoksa giriş ekranına at
    
    // Senin yazdığın 'me' fonksiyonu ile tokenı doğrula
    const { data: me, error } = await supabase.rpc('me', { p_token: token });
    if (error || !me) {
        res.clearCookie('mellow_token');
        return res.redirect('/auth');
    }
    
    req.user = me; // Oyuncu bilgilerini EJS'e aktarmak için kaydet
    req.token = token;
    next();
};

app.get('/', checkAuth, async (req, res) => {
    try {
        const { data: worlds, error } = await supabase.rpc('my_worlds', { p_token: req.token });
        if (error) throw error;
        
        // Supabase'den gelen pets verisini EJS'in çökmeyeceği GARANTİ bir formata çeviriyoruz
        const safeWorlds = (worlds || []).map(w => {
            const petData = Array.isArray(w.pets) ? w.pets[0] : w.pets;
            return {
                ...w,
                safePet: petData || { name: 'Bilinmeyen Pet', type: 'cat', level: 1 }
            };
        });
        
        res.render('index', { 
            player: req.user.username, 
            worlds: safeWorlds
        });
        
    } catch (err) {
        // Eğer yine hata olursa artık beyaz ekran 500 yerine, hatanın ne olduğunu ekrana yazacak
        console.error("Ana sayfa hatası:", err);
        res.status(500).send("Ana sayfa yüklenirken bir hata oluştu: " + err.message);
    }
});

// GİRİŞ/KAYIT EKRANI
app.get('/auth', (req, res) => {
    if (req.cookies.mellow_token) return res.redirect('/'); // Zaten giriş yapmışsa oyuna at
    res.render('auth');
});

// GİRİŞ / KAYIT İŞLEMİ (API)
app.post('/api/auth', async (req, res) => {
    const { username, password, mode } = req.body;
    const rpcName = mode === 'signup' ? 'register' : 'login';
    
    // Senin Supabase SQL fonksiyonlarını tetikliyoruz
    const { data, error } = await supabase.rpc(rpcName, { p_username: username, p_password: password });
    
    if (error || (data && data.error)) {
        return res.status(400).json({ error: error ? error.message : data.error });
    }
    
    // Giriş başarılıysa oyuncuya 30 günlük bir çerez veriyoruz
    res.cookie('mellow_token', data.token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.json({ success: true });
});

// PET ODASI (OYUN SAHNESİ)
app.get('/pet/:id', checkAuth, async (req, res) => {
    try {
        const worldId = req.params.id;
        
        const { data: worlds, error } = await supabase.rpc('my_worlds', { p_token: req.token });
        if (error) throw error;
        
        // == kullanıyoruz çünkü parametre metin (string), veritabanı ID'si rakam (int) olabilir
        const currentWorld = worlds ? worlds.find(w => w.id == worldId) : null;
        
        if (!currentWorld) {
            return res.redirect('/'); // Dünya bulunamazsa ana menüye dön
        }
        
        // Supabase bazen dizi, bazen obje döndürür. Çökmeyi engellemek için garantiliyoruz:
        const petData = Array.isArray(currentWorld.pets) ? currentWorld.pets[0] : currentWorld.pets;
        
        // Eğer petData boş gelirse EJS çökmesin diye sahte bir yedek (fallback) atıyoruz
        const safePet = petData || { 
            name: 'Gizemli Pet', type: 'cat', level: 1, hunger: 50, energy: 50, happiness: 50 
        };
        
        res.render('pet', { 
            player: req.user.username, 
            world: currentWorld,
            pet: safePet
        });
        
    } catch (err) {
        // Vercel'de hatanın sebebini görebilmek için ekrana basıyoruz
        console.error("Oda yüklenirken hata:", err);
        res.status(500).send("Oda yüklenemedi, sistem hatası: " + err.message);
    }
});

// ÇIKIŞ YAPMA (Çerezi Sil)
app.get('/logout', (req, res) => {
    res.clearCookie('mellow_token');
    res.redirect('/auth');
});

module.exports = app;