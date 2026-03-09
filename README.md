# Whac-A-Mole 🕹️🔨

Un juego arcade estilo Whac-A-Mole construido con HTML, CSS y JavaScript puro.

## 🎮 Jugar

Visita: [whac-a-mole.fnorman040.workers.dev](https://whac-a-mole.fnorman040.workers.dev/)

## ✨ Features

- 🐹 Grilla 3x3 con animaciones de pop-up
- ⭐ Topos dorados = puntos extra
- 💣 Bombas que restan puntos y tiempo
- 🔥 Sistema de combos (x1 → x5)
- 📈 Niveles progresivos
- 🔊 Efectos de sonido (Web Audio API)
- 🏆 High score persistente
- 📱 Responsive (mobile + desktop)

## 🚀 Deploy

Desplegado automáticamente en **Cloudflare Pages** desde este repo.

Cada push a `main` genera un nuevo deploy.

## 🛠️ Desarrollo local

```bash
# Clonar
git clone https://github.com/TU_USUARIO/whac-a-mole.git
cd whac-a-mole

# Servir localmente
python -m http.server 8080
# Abrir http://localhost:8080
```

## 📁 Estructura

```
whac-a-mole/
├── index.html    # Estructura del juego
├── styles.css    # Estética arcade retro
├── game.js       # Motor del juego
└── README.md     # Este archivo
```

## 📄 Licencia

MIT
