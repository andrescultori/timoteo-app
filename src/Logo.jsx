import React from 'react';

// TODO: trocar pelo vetor oficial (o André vai enviar). Trocar só este arquivo.
export default function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
      <path d="M24 2l1.1 2.9L28 6l-2.9 1.1L24 10l-1.1-2.9L20 6l2.9-1.1z" />
      <path d="M4 12l11 5v23L4 35z" />
      <path d="M44 12l-11 5v23l11-5z" />
      <path d="M7.5 16.6v17.2M10.8 18.1v17.8M40.5 16.6v17.2M37.2 18.1v17.8" stroke="var(--bg)" strokeWidth="1.3" fill="none" />
      <path d="M16.5 12h15v3.2h-5.6V38l-1.9 3.5-1.9-3.5V15.2h-5.6z" />
    </svg>
  );
}
