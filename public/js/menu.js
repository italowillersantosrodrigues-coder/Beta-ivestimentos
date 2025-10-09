// public/js/menu.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ menu.js carregado");

  const token = localStorage.getItem("token");
  if (!token) {
    alert("⚠️ Sessão expirada. Faça login novamente.");
    window.location.href = "/Login.html";
    return;
  }

  // Botões principais
  document.getElementById("btn-clientes")?.addEventListener("click", () => {
    window.location.href = "/clientes.html";
  });

  document.getElementById("btn-produtos")?.addEventListener("click", () => {
    window.location.href = "/produtos.html";
  });

  document.getElementById("btn-vendas")?.addEventListener("click", () => {
    window.location.href = "/vendas.html";
  });

  document.getElementById("btn-agenda")?.addEventListener("click", () => {
    window.location.href = "/agenda.html";
  });

  document.getElementById("btn-sair")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/Login.html";
  });
});
