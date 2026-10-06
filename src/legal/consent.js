// Textos EXATOS das caixas de consentimento (cópia de docs/legal/consentimento.md; o `npm run check` confere). Não alterar sem o André pedir.
// Marcação mínima: **negrito** e [Termos de Uso] / [Política de Privacidade] (viram links para #terms e #privacy).
export const CONSENT = {
  box1: 'Tenho **18 anos ou mais** e li e aceito os [Termos de Uso] e a [Política de Privacidade].',
  box2: 'Entendo que meus **favoritos, minha posição de leitura e o próprio uso de uma conta de estudo bíblico podem indicar minha convicção religiosa** (dado pessoal sensível). **Consinto** que o Timóteo App guarde esses dados **só para o app funcionar para mim**, sem uso em marketing nem compartilhamento. Posso retirar este consentimento a qualquer momento excluindo minha conta.',
  box3: 'Quero receber **novidades e promoções** do Timóteo App por e-mail. Posso cancelar quando quiser.',
  footer: 'Se preferir não criar conta, você pode usar o app normalmente: seus favoritos ficam só neste aparelho.',
};

// Confirmação de exclusão da conta (cópia de "Textos curtos" em docs/legal/consentimento.md). {data} e {email} entram na tela.
export const DELETE_TEXT = {
  base: "Isso apaga seu perfil, favoritos, posição de leitura e lista 'Avise-me', e encerra seu acesso. Os registros de pagamento ficam anonimizados pelo prazo fiscal.",
  pro: 'Você tem Pro até {data}; excluir a conta **não gera reembolso automático** (reembolso em até 7 dias: {email}).',
  confirm: 'Para confirmar, digite o seu e-mail.',
};
