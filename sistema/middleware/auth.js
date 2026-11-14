export function verificarAutenticacao(req, res, next) {
    if (req.session && req.session.usuario) {
        res.set('Cache-Control', 'no-store');
        return next();
    }
    res.redirect('/login');
}
