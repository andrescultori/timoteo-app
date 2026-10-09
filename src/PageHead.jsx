import React from 'react';
import BackButton from './BackButton.jsx';

// Cabeçalho das páginas (Linha do tempo, Personagens, Genealogia, Favoritos, Perfil, Termos e Política, retorno do pagamento, convite ao Pro):
// botão Voltar no topo, depois título (a única h1 da página), subtítulo e ações, direto sobre o fundo, no mesmo padrão da página do livro.
// O conteúdo vai em um `.card` (ver `.pg-card` em styles.css). Modais continuam com `.sheet`.
export default function PageHead({ t, id, title, sub, actions }) {
  return (
    <>
      <BackButton t={t} />
      <header className="pg-head">
        <div className="pg-ttl">
          <h1 id={id}>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {actions && <div className="pg-actions">{actions}</div>}
      </header>
    </>
  );
}
