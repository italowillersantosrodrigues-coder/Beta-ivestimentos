// public/js/login.js
// Versão corrigida: tratamento de respostas, logs e listeners para botões sociais

document.addEventListener("DOMContentLoaded", () => {
  console.log("login.js carregado");

  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");
  const googleBtn = document.getElementById("google-login");
  const githubBtn = document.getElementById("github-login");

  if (!form) {
    console.error("❌ Formulário não encontrado (#login-form)");
    return;
  }

  // Helper para mostrar erro
  function showError(message) {
    if (errorMsg) {
      errorMsg.style.display = "block";
      errorMsg.innerText = message;
    } else {
      alert("Erro: " + message);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorMsg) {
      errorMsg.style.display = "none";
      errorMsg.innerText = "";
    }

    const email = (document.getElementById("email")?.value || "").trim();
    const senha = (document.getElementById("senha")?.value || "").trim();

    console.log("Tentando login com:", email ? email : "(sem email)");

    if (!email || !senha) {
      showError("Preencha email e senha.");
      return;
    }

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha }), // server espera { email, password }
      });

      // Se o servidor respondeu com HTML (ex: 404 page), pegamos o texto e exibimos para debug
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await resp.text();
        console.warn("Resposta não-JSON do servidor:", resp.status, text.slice(0, 300));
        // Mostra uma mensagem amigável ao usuário
        if (resp.status === 404) {
          throw new Error("Rota não encontrada (404). Verifique a URL da API.");
        } else {
          throw new Error("Resposta inesperada do servidor. Veja console para mais detalhes.");
        }
      }

      const data = await resp.json();

      if (!resp.ok) {
        // se o servidor devolveu { error: "mensagem" } usamos isso
        const message = data?.error || data?.message || `Erro: ${resp.status}`;
        throw new Error(message);
      }

      // sucesso
      console.log("Login OK, resposta:", data);
      if (data.token) localStorage.setItem("token", data.token);
      // redireciona para o menu (página do painel)
      window.location.href = "/menu.html";
    } catch (err) {
      console.error("Erro no login (catch):", err);
      showError(err.message || "Falha no login");
    }
  });

  // Botões sociais — coloquei redirecionamentos padrão (adicione as rotas no servidor se quiser OAuth)
  if (googleBtn) {
    googleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Google login clicado");
      // Se você tiver rota OAuth: window.location.href = "/auth/google"
      // Senão, para teste, redireciona para menu (remova em produção)
      window.location.href = "/menu.html";
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Github login clicado");
      // Se tiver rota OAuth use: window.location.href = "/auth/github"
      window.location.href = "/menu.html";
    });
  }
});
