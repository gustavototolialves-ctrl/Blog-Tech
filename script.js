/*
  CONFIGURAÇÃO DAS REAÇÕES COMPARTILHADAS
  1) Crie um projeto no Supabase.
  2) Execute o arquivo supabase-setup.sql no SQL Editor.
  3) Em Project Settings > API, copie Project URL e anon/public key.
  4) Cole os valores abaixo. Nunca use a service_role key no site.
*/
const SUPABASE_URL = "COLE_AQUI_SUA_PROJECT_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_ANON_PUBLIC_KEY";

const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".menu");

menuToggle?.addEventListener("click", () => {
  const aberto = menu.classList.toggle("aberto");
  menuToggle.setAttribute("aria-expanded", String(aberto));
});

menu?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => menu.classList.remove("aberto"));
});

const EMOJIS = {
  amei: "😍",
  gostei: "👍",
  incrivel: "🤯",
  engracado: "😂",
  "nao-gostei": "😕"
};

const configurado = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("COLE_AQUI") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("COLE_AQUI");

function chaveVoto(articleId) {
  return `blogtech-voto-${articleId}`;
}

function mostrarStatus(card, mensagem) {
  const status = card.querySelector(".status-reacao");
  if (status) status.textContent = mensagem;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.method === "POST" ? "return=minimal" : "count=exact",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Erro ${response.status}`);
  }
  return response;
}

async function carregarReacoes(card) {
  const articleId = card.dataset.articleId;
  const buttons = card.querySelectorAll(".reacao");
  if (!configurado) {
    mostrarStatus(card, "Falta conectar o Supabase para compartilhar as reações.");
    buttons.forEach(button => button.disabled = true);
    return;
  }
  try {
    const response = await supabaseRequest(
      `article_reactions?select=reaction&article_id=eq.${encodeURIComponent(articleId)}`
    );
    const rows = await response.json();
    const counts = {};
    rows.forEach(row => counts[row.reaction] = (counts[row.reaction] || 0) + 1);
    buttons.forEach(button => {
      const type = button.dataset.reaction;
      button.querySelector("span").textContent = counts[type] || 0;
    });
    const meuVoto = localStorage.getItem(chaveVoto(articleId));
    if (meuVoto) {
      const selected = card.querySelector(`[data-reaction="${meuVoto}"]`);
      selected?.classList.add("selecionada");
    }
    mostrarStatus(card, "Reações compartilhadas com todos os visitantes.");
  } catch (error) {
    console.error(error);
    mostrarStatus(card, "Não foi possível carregar as reações. Confira a configuração.");
  }
}

async function votar(card, button) {
  const articleId = card.dataset.articleId;
  const reaction = button.dataset.reaction;
  const votoAnterior = localStorage.getItem(chaveVoto(articleId));

  if (votoAnterior) {
    mostrarStatus(card, "Você já reagiu a este artigo neste navegador.");
    return;
  }

  button.disabled = true;
  try {
    await supabaseRequest("article_reactions", {
      method: "POST",
      body: JSON.stringify({
        article_id: articleId,
        reaction,
        voter_id: crypto.randomUUID()
      })
    });
    localStorage.setItem(chaveVoto(articleId), reaction);
    await carregarReacoes(card);
    mostrarStatus(card, `Obrigado pela reação ${EMOJIS[reaction]}!`);
  } catch (error) {
    console.error(error);
    mostrarStatus(card, "Não foi possível registrar. Confira a conexão e tente novamente.");
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll(".artigo").forEach(card => {
  card.querySelectorAll(".reacao").forEach(button => {
    button.addEventListener("click", () => votar(card, button));
  });
  carregarReacoes(card);
});

// Atualiza as contagens periodicamente para acompanhar votos de outros visitantes.
if (configurado) {
  window.setInterval(() => {
    document.querySelectorAll(".artigo").forEach(carregarReacoes);
  }, 20000);
}
