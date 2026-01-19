const text = "Bienvenue chez Les Délices de Nawal";
let i = 0;

function typingEffect() {
  if (i < text.length) {
    document.getElementById("typing").innerHTML += text.charAt(i);
    i++;
    setTimeout(typingEffect, 80);
  }
}

typingEffect();
