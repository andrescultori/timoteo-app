// Testes de src/richText.js (formatação das notas do estudo) e de src/addTarget.js (estudo de destino do leitor).
import { parseNote, parseInline, plainText, applyFormat } from '../src/richText.js';

let passed = 0; let failed = 0;
const ok = (c, m) => { if (c) passed += 1; else { failed += 1; console.error(`FALHOU: ${m}`); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`);
const T = (v) => ({ t: 'text', v });

eq(parseInline('texto puro'), [T('texto puro')], 'texto puro');
eq(parseInline('a **b** c'), [T('a '), { t: 'b', c: [T('b')] }, T(' c')], 'negrito');
eq(parseInline('a *i* c'), [T('a '), { t: 'i', c: [T('i')] }, T(' c')], 'itálico');
eq(parseInline('a ++u++ c'), [T('a '), { t: 'u', c: [T('u')] }, T(' c')], 'sublinhado');
eq(parseInline('**a *b* c**'), [{ t: 'b', c: [T('a '), { t: 'i', c: [T('b')] }, T(' c')] }], 'aninhamento: itálico dentro de negrito');
eq(parseInline('++**x**++'), [{ t: 'u', c: [{ t: 'b', c: [T('x')] }] }], 'aninhamento: negrito dentro de sublinhado');
// marcação aberta ou vazia = texto puro
eq(parseInline('**aberto'), [T('**aberto')], 'negrito sem fechar');
eq(parseInline('*aberto'), [T('*aberto')], 'itálico sem fechar');
eq(parseInline('++aberto'), [T('++aberto')], 'sublinhado sem fechar');
eq(parseInline('****'), [T('****')], 'negrito vazio');
eq(parseInline('2 * 3 * 4'), [T('2 * 3 * 4')], 'asteriscos soltos com espaço não viram itálico');
eq(parseInline('** a **'), [T('** a **')], 'marcador com espaço por dentro não vale');
eq(parseInline('a ** b'), [T('a ** b')], 'um marcador só');
// uma linha só: o par não atravessa linhas
eq(parseNote('**a\nb**'), [{ type: 'p', lines: [[T('**a')], [T('b**')]] }], 'par em linhas diferentes é texto puro');
// títulos e parágrafos
eq(parseNote('# Título\n## Sub\ntexto'), [{ type: 'h1', lines: [[T('Título')]] }, { type: 'h2', lines: [[T('Sub')]] }, { type: 'p', lines: [[T('texto')]] }], 'títulos e parágrafo');
eq(parseNote('#sem espaço'), [{ type: 'p', lines: [[T('#sem espaço')]] }], '"#" sem espaço é texto');
eq(parseNote('### três'), [{ type: 'p', lines: [[T('### três')]] }], '"###" não é título');
eq(plainText('# '), '#', '"# " sem texto é só um "#"');
eq(parseNote('a\nb\n\nc'), [{ type: 'p', lines: [[T('a')], [T('b')]] }, { type: 'p', lines: [[T('c')]] }], 'linha em branco separa parágrafos');
eq(parseNote('# **t**'), [{ type: 'h1', lines: [[{ t: 'b', c: [T('t')] }]] }], 'negrito dentro de título');
eq(parseNote('a\r\nb'), [{ type: 'p', lines: [[T('a')], [T('b')]] }], 'CRLF');
eq(parseNote(''), [], 'vazio'); eq(parseNote(null), [], 'null');
eq(plainText('# T\n**a** e *b*'), 'T\na e b', 'plainText tira a marcação');

// XSS: nada vira HTML; o texto passa inteiro como texto (o React escapa), e a árvore nunca tem tags
const evil = '<script>alert(1)</script> **<img src=x onerror=alert(1)>** ++<b>x</b>++ [a](javascript:alert(1)) &lt;';
const tree = JSON.stringify(parseNote(evil));
ok(tree.includes('<script>alert(1)</script>') && tree.includes('<img src=x onerror=alert(1)>'), 'XSS: o texto do atacante fica como texto');
const kinds = new Set(); (function walk(n) { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n.t) kinds.add(n.t); if (n.type) kinds.add(n.type); Object.values(n).forEach(walk); } })(parseNote(evil));
ok([...kinds].every((k) => ['text', 'b', 'i', 'u', 'p', 'h1', 'h2'].includes(k)), 'XSS: a árvore só tem os nós permitidos');
ok(!/dangerouslySetInnerHTML/.test((await import('node:fs')).readFileSync(new URL('../src/NoteText.jsx', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')), 'NoteText não usa dangerouslySetInnerHTML');
// texto longo e muito aninhado não trava
const t0 = Date.now(); parseNote(('**a** *b* ++c++ ').repeat(300) + '*'.repeat(500)); ok(Date.now() - t0 < 1500, 'entrada grande é rápida');

// ---- applyFormat ----
eq(applyFormat('abc def', 4, 7, 'b'), { value: 'abc **def**', start: 6, end: 9 }, 'negrito na seleção');
eq(applyFormat('abc **def**', 4, 11, 'b').value, 'abc def', 'tira o negrito (seleção com marcadores)');
eq(applyFormat('abc **def**', 6, 9, 'b').value, 'abc def', 'tira o negrito (marcadores em volta)');
eq(applyFormat('abc', 1, 1, 'i'), { value: 'a**bc', start: 2, end: 2 }, 'sem seleção insere o par e deixa o cursor no meio');
eq(applyFormat('x y', 0, 1, 'u').value, '++x++ y', 'sublinhado');
eq(applyFormat('linha', 0, 5, 'h1').value, '# linha', 'H1');
eq(applyFormat('# linha', 2, 2, 'h1').value, 'linha', 'H1 de novo tira');
eq(applyFormat('# linha', 0, 0, 'h2').value, '## linha', 'H2 troca o H1');
eq(applyFormat('a\nb\nc', 2, 2, 'h1').value, 'a\n# b\nc', 'título só na linha do cursor');
eq(applyFormat('a\nb\nc', 0, 3, 'h2').value, '## a\n## b\nc', 'título nas linhas da seleção');
eq(applyFormat('abc', 0, 3, 'zzz').value, 'abc', 'formato desconhecido não muda');
{ // ida e volta: formatar e renderizar não perde o texto
  let v = 'olá mundo'; v = applyFormat(v, 4, 9, 'b').value; v = applyFormat(v, 0, 3, 'i').value;
  eq(plainText(v), 'olá mundo', 'formatar não muda o texto');
}

console.log(failed ? `\n${failed} teste(s) falharam, ${passed} passaram.` : `OK: ${passed} testes de formatação passaram.`);
process.exit(failed ? 1 : 0);
