import React from 'react';
import { HeartIcon } from './icons.jsx';
import { useUserData, toggleFav } from './userdata.js';

// Coração de favorito. Nunca exige cadastro; funciona com o localStorage indisponível (só na sessão).
export default function FavButton({ favKey, t, className = '' }) {
  const { keys } = useUserData();
  const on = keys.has(favKey);
  const label = on ? t.favRemove : t.favAdd;
  return (
    <button type="button" className={`fav-btn ${className}`} aria-pressed={on} aria-label={label} title={label} onClick={() => toggleFav(favKey)}>
      <HeartIcon filled={on} />
    </button>
  );
}
