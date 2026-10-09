// Hebraico: acentos de cantilação (te'amim, U+0591 a U+05AF) são os sinais de entonação da leitura cantada; as vogais (niqqud) e o
// resto do texto ficam. Só tira para exibir; o dado guarda o texto como vem do OSHB, sem normalização (o OSHB desaconselha NFC).
export const stripCantillation = (s) => s.replace(/[֑-֯]/g, '');
