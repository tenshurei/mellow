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

// ANA SAYFA (SADECE GİRİŞ YAPANLAR GÖREBİLİR)
app.get('/', checkAuth, async (req, res) => {
    // Senin yazdığın 'my_worlds' fonksiyonu ile oyuncunun dünyalarını çekiyoruz
    const { data: worlds } = await supabase.rpc('my_worlds', { p_token: req.token });
    
    // EJS çökmesin diye arayüzün beklediği sahte veriyi şimdilik tekrar ekliyoruz
    const petData = {
        name: 'Mochi',
        level: 4,
        stats: { hunger: 80, energy: 60, happiness: 90 }
    };
    
    // Verileri EJS'e yolla
    res.render('index', { 
        player: req.user.username, 
        worlds: worlds || [],
        pet: petData 
    });
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

// ÇIKIŞ YAPMA (Çerezi Sil)
app.get('/logout', (req, res) => {
    res.clearCookie('mellow_token');
    res.redirect('/auth');
});

module.exports = app;