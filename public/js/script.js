async function getCurrentUser() {
  const res = await fetch("/api/me");
  return res.json();
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
}

function showMessage(elementId, text, type) {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = text;
  box.className = `message-box ${type}`;
}

async function loadPlats() {
  const container = document.getElementById("plats-container");
  const select = document.getElementById("plat");

  if (!container && !select) return;

  const res = await fetch("/api/plats");
  const plats = await res.json();

  if (container) {
    container.innerHTML = "";

    plats.forEach((plat) => {
      const card = document.createElement("div");
      card.className = "card";

      const imageSrc = plat.image && plat.image.trim() !== "" ? plat.image : "https://via.placeholder.com/400x300";

      card.innerHTML = `
        <img src="${imageSrc}" alt="${plat.nom}">
        <div class="card-content">
          <h3>${plat.nom}</h3>
          <p>${plat.description || ""}</p>
          <p class="price">${plat.prix} €</p>
          <p><strong>Catégorie :</strong> ${plat.categorie}</p>
          <p class="quote">${plat.citation || ""}</p>
        </div>
      `;

      container.appendChild(card);
    });
  }

  if (select) {
    select.innerHTML = `<option value="">Choisir un plat</option>`;
    plats.forEach((plat) => {
      const option = document.createElement("option");
      option.value = plat.nom;
      option.textContent = `${plat.nom} - ${plat.prix} €`;
      select.appendChild(option);
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const userData = await getCurrentUser();
  const user = userData.user;

  const authLinks = document.getElementById("auth-links");
  const userLinks = document.getElementById("user-links");
  const adminLink = document.getElementById("admin-link");

  if (authLinks && userLinks) {
    if (user) {
      authLinks.classList.add("hidden");
      userLinks.classList.remove("hidden");
      if (adminLink && user.role === "admin") {
        adminLink.classList.remove("hidden");
      }
    } else {
      authLinks.classList.remove("hidden");
      userLinks.classList.add("hidden");
    }
  }

  await loadPlats();

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullname = document.getElementById("fullname").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showMessage("register-message", data.message, "success");
        setTimeout(() => {
          window.location.href = "/account.html";
        }, 800);
      } else {
        showMessage("register-message", data.error, "error");
      }
    });
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showMessage("login-message", data.message, "success");
        setTimeout(() => {
          if (data.user.role === "admin") {
            window.location.href = "/admin.html";
          } else {
            window.location.href = "/account.html";
          }
        }, 800);
      } else {
        showMessage("login-message", data.error, "error");
      }
    });
  }

  const demandeForm = document.getElementById("demande-form");
  if (demandeForm) {
    demandeForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const body = {
        nom: document.getElementById("nom").value.trim(),
        email: document.getElementById("email-demande").value.trim(),
        telephone: document.getElementById("telephone").value.trim(),
        plat: document.getElementById("plat").value,
        quantite: document.getElementById("quantite").value,
        date_souhaitee: document.getElementById("date_souhaitee").value,
        message: document.getElementById("message").value.trim()
      };

      const res = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        showMessage("demande-message", data.message, "success");
        demandeForm.reset();
      } else {
        showMessage("demande-message", data.error, "error");
      }
    });
  }

  const accountName = document.getElementById("account-name");
  const demandesBody = document.getElementById("demandes-body");

  if (accountName && demandesBody) {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    accountName.textContent = user.fullname;

    const res = await fetch("/api/my-demandes");
    const demandes = await res.json();

    demandesBody.innerHTML = "";

    if (demandes.length === 0) {
      demandesBody.innerHTML = `<tr><td colspan="6">Aucune demande pour le moment</td></tr>`;
    } else {
      demandes.forEach((item) => {
        demandesBody.innerHTML += `
          <tr>
            <td>${item.plat}</td>
            <td>${item.quantite}</td>
            <td>${item.date_souhaitee || "-"}</td>
            <td>${item.message || "-"}</td>
            <td>${item.statut}</td>
            <td>${item.created_at}</td>
          </tr>
        `;
      });
    }
  }

  const adminDemandesBody = document.getElementById("admin-demandes-body");
  const adminPlatForm = document.getElementById("admin-plat-form");

  if (adminDemandesBody && adminPlatForm) {
    if (!user || user.role !== "admin") {
      window.location.href = "/login.html";
      return;
    }

    const res = await fetch("/api/admin/demandes");
    const demandes = await res.json();

    adminDemandesBody.innerHTML = "";

    if (demandes.length === 0) {
      adminDemandesBody.innerHTML = `<tr><td colspan="8">Aucune demande</td></tr>`;
    } else {
      demandes.forEach((item) => {
        adminDemandesBody.innerHTML += `
          <tr>
            <td>${item.nom}</td>
            <td>${item.email}</td>
            <td>${item.telephone}</td>
            <td>${item.plat}</td>
            <td>${item.quantite}</td>
            <td>${item.date_souhaitee || "-"}</td>
            <td>${item.message || "-"}</td>
            <td>${item.created_at}</td>
          </tr>
        `;
      });
    }

    adminPlatForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const body = {
        nom: document.getElementById("plat-nom").value.trim(),
        description: document.getElementById("plat-description").value.trim(),
        citation: document.getElementById("plat-citation").value.trim(),
        prix: document.getElementById("plat-prix").value,
        image: document.getElementById("plat-image").value.trim(),
        categorie: document.getElementById("plat-categorie").value
      };

      const resAdd = await fetch("/api/admin/plats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await resAdd.json();

      if (resAdd.ok) {
        showMessage("admin-plat-message", data.message, "success");
        adminPlatForm.reset();
      } else {
        showMessage("admin-plat-message", data.error, "error");
      }
    });
  }
});