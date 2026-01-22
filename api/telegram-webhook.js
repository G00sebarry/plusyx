module.exports = (req, res) => {
  res.status(200).json({ 
    status: "ok",
    method: req.method,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
  });
};
