# Personagens por capítulo (relatório gerado)

Gerado em 2026-10-09 por `node scripts/build-people-chapters.mjs`. **Não edite à mão**: as decisões vão em `scripts/data/people-chapters-overrides.json` e `scripts/data/people-aliases.json`.

"Aparece" aqui significa **citado pelo nome** no texto da Bíblia Livre (nada de pronome nem contexto), nos livros de `books[]` do personagem.

## Totais

- Personagens em people.json: 210
- Com pelo menos um capítulo: 202
- Sem nenhum capítulo achado: 8
- Pares personagem + livro + capítulo: 1581
- Ocorrências ambíguas ainda "a revisar": 204

## Personagens sem nenhum capítulo achado

Provável causa: grafia diferente na Bíblia Livre (acrescente em `people-aliases.json`), `autoLink: false`, ou o nome não aparece no texto (ex.: "as filhas de Zelofeade").

- `jose-marido-de-maria` — José, marido de Maria; livros: mat, luk
- `tiago-zebedeu` — Tiago, filho de Zebedeu; livros: mat, act
- `maria-de-betania` — Maria de Betânia; livros: luk, joh
- `simao-zelote` — Simão, o zelote; livros: mat, mar, luk, act
- `juda` — Judá, filho de Jacó (autoLink: false, só `include` manual); livros: gen
- `herodes-grande` — Herodes o Grande; livros: mat, luk
- `herodes-antipas` — Herodes Antipas; livros: mat, mar, luk, act
- `ana-profetisa` — Ana, a profetisa (autoLink: false, só `include` manual); livros: luk

## Achados fora de `books[]` (não entram no JSON)

Nome sem ambiguidade citado em livro que não consta em `books[]` do personagem. Se o livro deve constar, acrescente em people.json (precisa de `role` PT/EN, decisão sua); a lateral só mostra o que está em `books[]`.

- Abel (`abel`) em 2Sm: caps. 20
- Abel (`abel`) em Mt: caps. 23
- Abel (`abel`) em Lc: caps. 11
- Abigail, esposa de Davi (`abigail`) em 1Cr: caps. 2, 3
- Abimeleque (`abimeleque`) em Gn: caps. 20, 21, 26
- Abimeleque (`abimeleque`) em 1Cr: caps. 18
- Abner (`abner`) em 1Rs: caps. 2
- Abner (`abner`) em 1Cr: caps. 26, 27
- Abraão (`abraao`) em Êx: caps. 2–4, 6, 32, 33
- Abraão (`abraao`) em Lv: caps. 26
- Abraão (`abraao`) em Nm: caps. 32
- Abraão (`abraao`) em Dt: caps. 1, 6, 9, 29, 30, 34
- Abraão (`abraao`) em Js: caps. 24
- Abraão (`abraao`) em 1Rs: caps. 18
- Abraão (`abraao`) em 2Rs: caps. 13
- Abraão (`abraao`) em 1Cr: caps. 1, 16, 29
- Abraão (`abraao`) em 2Cr: caps. 20, 30
- Abraão (`abraao`) em Ne: caps. 9
- Abraão (`abraao`) em Sl: caps. 47, 105
- Abraão (`abraao`) em Is: caps. 29, 41, 51, 63
- Abraão (`abraao`) em Jr: caps. 33
- Abraão (`abraao`) em Ez: caps. 33
- Abraão (`abraao`) em Mq: caps. 7
- Abraão (`abraao`) em Mt: caps. 1, 3, 8, 22
- Abraão (`abraao`) em Mc: caps. 12
- Abraão (`abraao`) em Lc: caps. 1, 3, 13, 16, 19, 20
- Abraão (`abraao`) em Jo: caps. 8
- Abraão (`abraao`) em At: caps. 3, 7, 13
- Abraão (`abraao`) em Rm: caps. 4, 9, 11
- Abraão (`abraao`) em 2Co: caps. 11
- Abraão (`abraao`) em Gl: caps. 3, 4
- Abraão (`abraao`) em Hb: caps. 2, 6, 7, 11
- Abraão (`abraao`) em 1Pe: caps. 3
- Absalão (`absalao`) em 1Rs: caps. 1, 2, 15
- Absalão (`absalao`) em 1Cr: caps. 3
- Absalão (`absalao`) em 2Cr: caps. 11
- Absalão (`absalao`) em Sl: títulos dos salmos 3
- Acabe (`acabe`) em 2Rs: caps. 1, 3, 8–10, 21
- Acabe (`acabe`) em 2Cr: caps. 18, 21, 22
- Acabe (`acabe`) em Jr: caps. 29
- Acabe (`acabe`) em Mq: caps. 6
- Acã (`acan`) em Gn: caps. 36
- Acaz (`acaz`) em 1Cr: caps. 3, 8, 9
- Acaz (`acaz`) em Os: caps. 1
- Adão (`adao`) em 1Cr: caps. 1
- Adão (`adao`) em Os: caps. 6
- Adão (`adao`) em Lc: caps. 3
- Adão (`adao`) em Rm: caps. 5
- Adão (`adao`) em 1Co: caps. 15
- Adão (`adao`) em 1Tm: caps. 2
- Adão (`adao`) em Jd: caps. 1
- Agar (`agar`) em Gl: caps. 4
- Amazias, sacerdote de Betel (`amazias-betel`) em 2Rs: caps. 14, 15
- Amazias, sacerdote de Betel (`amazias-betel`) em 1Cr: caps. 3, 4, 6
- Amazias, sacerdote de Betel (`amazias-betel`) em 2Cr: caps. 24–26
- Amós (`amos`) em Is: caps. 37
- Amós (`amos`) em Lc: caps. 3
- Ana (`ana`) em 1Cr: caps. 1
- Ana (`ana`) em Lc: caps. 2
- André (`andre`) em Mc: caps. 1, 3, 13
- André (`andre`) em Lc: caps. 6
- André (`andre`) em At: caps. 1
- Arão (`arao`) em Lv: caps. 1–3, 6–11, 13–17, 21, 22, 24
- Arão (`arao`) em Nm: caps. 1–4, 6–10, 12–20, 25–27, 33
- Arão (`arao`) em Dt: caps. 9, 10, 32
- Arão (`arao`) em Js: caps. 21, 24
- Arão (`arao`) em Jz: caps. 20
- Arão (`arao`) em 1Sm: caps. 12
- Arão (`arao`) em 1Cr: caps. 6, 12, 15, 23, 24
- Arão (`arao`) em 2Cr: caps. 13, 26, 29, 31, 35
- Arão (`arao`) em Ed: caps. 7
- Arão (`arao`) em Ne: caps. 10, 12
- Arão (`arao`) em Sl: caps. 77, 99, 105, 106, 115, 118, 133, 135
- Arão (`arao`) em Mq: caps. 6
- Arão (`arao`) em Mt: caps. 1
- Arão (`arao`) em Lc: caps. 1
- Arão (`arao`) em At: caps. 7
- Arão (`arao`) em Hb: caps. 5, 7, 9
- Asa (`asa`) em 1Cr: caps. 3, 9
- Asa (`asa`) em Jr: caps. 41
- Asa (`asa`) em Mt: caps. 1
- Asafe (`asafe`) em 2Rs: caps. 18
- Asafe (`asafe`) em Ne: caps. 2, 7, 11, 12
- Asafe (`asafe`) em Is: caps. 36
- Assuero (`assuero`) em Ed: caps. 4
- Assuero (`assuero`) em Dn: caps. 9
- Balaão (`balaao`) em Dt: caps. 23
- Balaão (`balaao`) em Ne: caps. 13
- Balaão (`balaao`) em Mq: caps. 6
- Balaão (`balaao`) em Ap: caps. 2
- Balaque (`balaque`) em Ap: caps. 2
- Barnabé (`barnabe`) em 1Co: caps. 9
- Barnabé (`barnabe`) em Cl: caps. 4
- Baruque (`baruque`) em Ne: caps. 3, 10, 11
- Bate-Seba (`bate-seba`) em Sl: títulos dos salmos 51
- Bezalel (`bezalel`) em 1Cr: caps. 2
- Bezalel (`bezalel`) em Ed: caps. 10
- Boaz (`boaz`) em 1Rs: caps. 7
- Boaz (`boaz`) em 1Cr: caps. 2
- Boaz (`boaz`) em 2Cr: caps. 3
- Boaz (`boaz`) em Mt: caps. 1
- Boaz (`boaz`) em Lc: caps. 3
- Caim (`caim`) em Js: caps. 15
- Caim (`caim`) em Hb: caps. 11
- Caim (`caim`) em 1Jo: caps. 3
- Caim (`caim`) em Jd: caps. 1
- Calebe (`calebe`) em Js: caps. 14, 15, 21
- Calebe (`calebe`) em Jz: caps. 1, 3
- Calebe (`calebe`) em 1Sm: caps. 25, 30
- Calebe (`calebe`) em 1Cr: caps. 2, 4, 6
- Ciro (`ciro`) em Dn: caps. 1, 6, 10
- Corá (`cora`) em Gn: caps. 36
- Corá (`cora`) em Êx: caps. 6
- Corá (`cora`) em 1Cr: caps. 1, 2, 6, 9, 26
- Corá (`cora`) em 2Cr: caps. 20, 31
- Daniel (`daniel`) em 1Cr: caps. 3
- Daniel (`daniel`) em Ed: caps. 8
- Daniel (`daniel`) em Ne: caps. 10
- Daniel (`daniel`) em Ez: caps. 14, 28
- Daniel (`daniel`) em Mt: caps. 24
- Davi (`davi`) em Rt: caps. 4
- Davi (`davi`) em 1Rs: caps. 1–3, 5–9, 11–15, 22
- Davi (`davi`) em 2Rs: caps. 8, 9, 11, 12, 14–22
- Davi (`davi`) em 2Cr: caps. 1–3, 5–14, 16, 17, 21, 23, 24, 27–30, 32–35
- Davi (`davi`) em Ed: caps. 3, 8
- Davi (`davi`) em Ne: caps. 3, 12
- Davi (`davi`) em Pv: caps. 1
- Davi (`davi`) em Ec: caps. 1
- Davi (`davi`) em Ct: caps. 4
- Davi (`davi`) em Is: caps. 7, 9, 16, 22, 29, 37, 38, 55
- Davi (`davi`) em Jr: caps. 13, 17, 21–23, 29, 30, 33, 36
- Davi (`davi`) em Ez: caps. 34, 37
- Davi (`davi`) em Os: caps. 3
- Davi (`davi`) em Am: caps. 6, 9
- Davi (`davi`) em Zc: caps. 12, 13
- Davi (`davi`) em Mt: caps. 1, 9, 12, 15, 20–22
- Davi (`davi`) em Mc: caps. 2, 10–12
- Davi (`davi`) em Lc: caps. 1–3, 6, 18, 20
- Davi (`davi`) em Jo: caps. 7
- Davi (`davi`) em At: caps. 1, 2, 4, 7, 13, 15
- Davi (`davi`) em Rm: caps. 1, 4, 11
- Davi (`davi`) em 2Tm: caps. 2
- Davi (`davi`) em Hb: caps. 4, 11
- Davi (`davi`) em Ap: caps. 3, 5, 22
- Débora (`debora`) em Gn: caps. 35
- Demétrio (`demetrio`) em At: caps. 19
- Eleazar (`eleazar`) em Dt: caps. 10
- Eleazar (`eleazar`) em Jz: caps. 20
- Eleazar (`eleazar`) em 1Sm: caps. 7
- Eleazar (`eleazar`) em 2Sm: caps. 23
- Eleazar (`eleazar`) em 1Cr: caps. 6, 9, 11, 23, 24
- Eleazar (`eleazar`) em Ed: caps. 7, 8, 10
- Eleazar (`eleazar`) em Ne: caps. 12
- Eleazar (`eleazar`) em Mt: caps. 1
- Eli (`eli`) em 1Rs: caps. 2
- Eli (`eli`) em Mt: caps. 27
- Eli (`eli`) em Lc: caps. 3
- Elias (`elias`) em 1Cr: caps. 8
- Elias (`elias`) em 2Cr: caps. 21
- Elias (`elias`) em Ed: caps. 10
- Elias (`elias`) em Ml: caps. 4
- Elias (`elias`) em Mt: caps. 11, 16, 17, 27
- Elias (`elias`) em Mc: caps. 6, 8, 9, 15
- Elias (`elias`) em Lc: caps. 1, 4, 9
- Elias (`elias`) em Jo: caps. 1
- Elias (`elias`) em Rm: caps. 11
- Elifaz (`elifaz`) em Gn: caps. 36
- Elifaz (`elifaz`) em 1Cr: caps. 1
- Eliseu (`eliseu`) em 1Rs: caps. 19
- Eliseu (`eliseu`) em Lc: caps. 4
- Eliú (`eliu`) em 1Sm: caps. 1
- Eliú (`eliu`) em 1Cr: caps. 12, 26, 27
- Enoque (`enoque`) em Êx: caps. 6
- Enoque (`enoque`) em Nm: caps. 26
- Enoque (`enoque`) em 1Cr: caps. 1, 5
- Esaú (`esau`) em Dt: caps. 2
- Esaú (`esau`) em Js: caps. 24
- Esaú (`esau`) em 1Cr: caps. 1
- Esaú (`esau`) em Jr: caps. 49
- Esaú (`esau`) em Ob: caps. 1
- Esaú (`esau`) em Ml: caps. 1
- Esaú (`esau`) em Rm: caps. 9
- Esaú (`esau`) em Hb: caps. 11, 12
- Eúde (`eude`) em 1Cr: caps. 7, 8
- Eva (`eva`) em 2Co: caps. 11
- Eva (`eva`) em 1Tm: caps. 2
- Ezequias (`ezequias`) em 1Cr: caps. 3, 4
- Ezequias (`ezequias`) em Ed: caps. 2
- Ezequias (`ezequias`) em Ne: caps. 7, 10
- Ezequias (`ezequias`) em Pv: caps. 25
- Ezequias (`ezequias`) em Jr: caps. 15, 26
- Ezequias (`ezequias`) em Os: caps. 1
- Ezequias (`ezequias`) em Sf: caps. 1
- Ezequias (`ezequias`) em Mt: caps. 1
- Fineias (`fineias`) em Êx: caps. 6
- Fineias (`fineias`) em 1Sm: caps. 1, 2, 4, 14
- Fineias (`fineias`) em 1Cr: caps. 6, 9
- Fineias (`fineias`) em Ed: caps. 7, 8
- Gaio (destinatário de 3 João) (`gaio-3jo`) em At: caps. 19, 20
- Gaio (destinatário de 3 João) (`gaio-3jo`) em Rm: caps. 16
- Gaio (destinatário de 3 João) (`gaio-3jo`) em 1Co: caps. 1
- Gamaliel (`gamaliel`) em Nm: caps. 1, 2, 7, 10
- Gedalias (`gedalias`) em 1Cr: caps. 25
- Gedalias (`gedalias`) em Ed: caps. 10
- Gedalias (`gedalias`) em Sf: caps. 1
- Gideão (`gideao`) em Hb: caps. 11
- Gogue (`gogue`) em 1Cr: caps. 5
- Golias (`golias`) em 2Sm: caps. 21
- Golias (`golias`) em 1Cr: caps. 20
- Gômer (`gomer`) em Gn: caps. 10
- Gômer (`gomer`) em 1Cr: caps. 1
- Gômer (`gomer`) em Ez: caps. 38
- Hananias, filho de Azur (`hananias-profeta`) em 1Cr: caps. 3, 8, 25
- Hananias, filho de Azur (`hananias-profeta`) em 2Cr: caps. 26
- Hananias, filho de Azur (`hananias-profeta`) em Ed: caps. 10
- Hananias, filho de Azur (`hananias-profeta`) em Ne: caps. 3, 7, 10, 12
- Hirão (`hirao`) em Gn: caps. 36
- Hirão (`hirao`) em 2Sm: caps. 5
- Hirão (`hirao`) em 1Cr: caps. 14
- Isaías (`isaias`) em 2Rs: caps. 19, 20
- Isaías (`isaias`) em 2Cr: caps. 26, 32
- Isaías (`isaias`) em Mt: caps. 3, 4, 8, 12, 13, 15
- Isaías (`isaias`) em Mc: caps. 1, 7
- Isaías (`isaias`) em Lc: caps. 3, 4
- Isaías (`isaias`) em Jo: caps. 1, 12
- Isaías (`isaias`) em At: caps. 8, 28
- Isaías (`isaias`) em Rm: caps. 9, 10, 15
- Isaque (`isaque`) em Êx: caps. 2–4, 6, 32, 33
- Isaque (`isaque`) em Lv: caps. 26
- Isaque (`isaque`) em Nm: caps. 32
- Isaque (`isaque`) em Dt: caps. 1, 6, 9, 29, 30, 34
- Isaque (`isaque`) em Js: caps. 24
- Isaque (`isaque`) em 1Rs: caps. 18
- Isaque (`isaque`) em 2Rs: caps. 13
- Isaque (`isaque`) em 1Cr: caps. 1, 16, 29
- Isaque (`isaque`) em 2Cr: caps. 30
- Isaque (`isaque`) em Sl: caps. 105
- Isaque (`isaque`) em Jr: caps. 33
- Isaque (`isaque`) em Am: caps. 7
- Isaque (`isaque`) em Mt: caps. 1, 8, 22
- Isaque (`isaque`) em Mc: caps. 12
- Isaque (`isaque`) em Lc: caps. 3, 13, 20
- Isaque (`isaque`) em At: caps. 3, 7
- Isaque (`isaque`) em Rm: caps. 9
- Isaque (`isaque`) em Gl: caps. 4
- Isaque (`isaque`) em Hb: caps. 11
- Isaque (`isaque`) em Tg: caps. 2
- Ismael, filho de Abraão (`ismael`) em 2Rs: caps. 25
- Ismael, filho de Abraão (`ismael`) em 1Cr: caps. 1, 8, 9
- Ismael, filho de Abraão (`ismael`) em 2Cr: caps. 19, 23
- Ismael, filho de Abraão (`ismael`) em Ed: caps. 10
- Ismael, filho de Abraão (`ismael`) em Jr: caps. 40, 41
- Itamar (`itamar`) em Nm: caps. 3, 4, 7, 26
- Itamar (`itamar`) em Ed: caps. 8
- Jacó (Israel) (`jaco`) em Êx: caps. 1–4, 6, 19, 33
- Jacó (Israel) (`jaco`) em Lv: caps. 26
- Jacó (Israel) (`jaco`) em Nm: caps. 23, 24, 32
- Jacó (Israel) (`jaco`) em Dt: caps. 1, 6, 9, 29, 30, 32–34
- Jacó (Israel) (`jaco`) em Js: caps. 24
- Jacó (Israel) (`jaco`) em 1Sm: caps. 12
- Jacó (Israel) (`jaco`) em 2Sm: caps. 23
- Jacó (Israel) (`jaco`) em 1Rs: caps. 18
- Jacó (Israel) (`jaco`) em 2Rs: caps. 13, 17
- Jacó (Israel) (`jaco`) em 1Cr: caps. 16
- Jacó (Israel) (`jaco`) em Sl: caps. 14, 20, 22, 24, 44, 46, 47, 53, 59, 75–79, 81, 84, 85, 87, 94, 99, 105, 114, 132, 135, 146, 147
- Jacó (Israel) (`jaco`) em Is: caps. 2, 8–10, 14, 17, 27, 29, 40–46, 48, 49, 58–60, 65
- Jacó (Israel) (`jaco`) em Jr: caps. 2, 5, 10, 30, 31, 33, 46, 51
- Jacó (Israel) (`jaco`) em Lm: caps. 1, 2
- Jacó (Israel) (`jaco`) em Ez: caps. 20, 28, 37, 39
- Jacó (Israel) (`jaco`) em Os: caps. 10, 12
- Jacó (Israel) (`jaco`) em Am: caps. 3, 6–9
- Jacó (Israel) (`jaco`) em Ob: caps. 1
- Jacó (Israel) (`jaco`) em Mq: caps. 1–5, 7
- Jacó (Israel) (`jaco`) em Na: caps. 2
- Jacó (Israel) (`jaco`) em Ml: caps. 1–3
- Jacó (Israel) (`jaco`) em Mt: caps. 1, 8, 22
- Jacó (Israel) (`jaco`) em Mc: caps. 12
- Jacó (Israel) (`jaco`) em Lc: caps. 1, 3, 9, 13, 20
- Jacó (Israel) (`jaco`) em Jo: caps. 4
- Jacó (Israel) (`jaco`) em At: caps. 3, 7
- Jacó (Israel) (`jaco`) em Rm: caps. 9, 11
- Jacó (Israel) (`jaco`) em Hb: caps. 11
- Jefté (`jefte`) em 1Sm: caps. 12
- Jefté (`jefte`) em Hb: caps. 11
- Jeoaquim (`jeoaquim`) em 1Cr: caps. 3
- Jeremias (`jeremias`) em 2Rs: caps. 23, 24
- Jeremias (`jeremias`) em 1Cr: caps. 5, 12
- Jeremias (`jeremias`) em 2Cr: caps. 35, 36
- Jeremias (`jeremias`) em Ed: caps. 1
- Jeremias (`jeremias`) em Ne: caps. 10, 12
- Jeremias (`jeremias`) em Dn: caps. 9
- Jeremias (`jeremias`) em Mt: caps. 2, 16, 27
- Jesus (`jesus`) em At: caps. 1–11, 13, 15–22, 25, 26, 28
- Jesus (`jesus`) em Rm: caps. 1–8, 10, 13–16
- Jesus (`jesus`) em 1Co: caps. 1–6, 8, 9, 11, 12, 15, 16
- Jesus (`jesus`) em 2Co: caps. 1, 4, 5, 8, 11, 13
- Jesus (`jesus`) em Gl: caps. 1–6
- Jesus (`jesus`) em Ef: caps. 1–6
- Jesus (`jesus`) em Fp: caps. 1–4
- Jesus (`jesus`) em Cl: caps. 1–4
- Jesus (`jesus`) em 1Ts: caps. 1–5
- Jesus (`jesus`) em 2Ts: caps. 1–3
- Jesus (`jesus`) em 1Tm: caps. 1–6
- Jesus (`jesus`) em 2Tm: caps. 1–4
- Jesus (`jesus`) em Tt: caps. 1–3
- Jesus (`jesus`) em Fm: caps. 1
- Jesus (`jesus`) em Tg: caps. 1, 2
- Jesus (`jesus`) em 1Pe: caps. 1–5
- Jesus (`jesus`) em 2Pe: caps. 1–3
- Jesus (`jesus`) em 2Jo: caps. 1
- Jesus (`jesus`) em Jd: caps. 1
- Jeú (`jeu`) em 1Rs: caps. 16, 19
- Jeú (`jeu`) em 1Cr: caps. 2, 4, 12
- Jeú (`jeu`) em 2Cr: caps. 19, 20, 22, 25
- Jeú (`jeu`) em Os: caps. 1
- Jezabel (`jezabel`) em 2Rs: caps. 9
- Jezabel (`jezabel`) em Ap: caps. 2
- Jó (`jo`) em Gn: caps. 46
- Jó (`jo`) em Ez: caps. 14
- Joabe (`joabe`) em 1Sm: caps. 26
- Joabe (`joabe`) em 1Rs: caps. 1, 2, 11
- Joabe (`joabe`) em Ed: caps. 8
- Joabe (`joabe`) em Ne: caps. 7
- Joabe (`joabe`) em Sl: títulos dos salmos 60
- João Batista (`joao-batista`) em Lc: caps. 7, 9
- João Marcos (`joao-marcos`) em 2Tm: caps. 4
- João Marcos (`joao-marcos`) em Fm: caps. 1
- Joaquim (Jeconias) (`joaquim`) em 1Cr: caps. 3
- Joaquim (Jeconias) (`joaquim`) em Et: caps. 2
- Joel (`joel`) em 1Sm: caps. 8
- Joel (`joel`) em 1Cr: caps. 4–7, 11, 15, 23, 26, 27
- Joel (`joel`) em 2Cr: caps. 29
- Joel (`joel`) em Ed: caps. 10
- Joel (`joel`) em Ne: caps. 11
- Joiada, o sacerdote (`joiada`) em 2Sm: caps. 8, 20, 23
- Joiada, o sacerdote (`joiada`) em 1Rs: caps. 1, 2, 4
- Joiada, o sacerdote (`joiada`) em 1Cr: caps. 11, 12, 18, 27
- Joiada, o sacerdote (`joiada`) em Ne: caps. 3, 12, 13
- Joiada, o sacerdote (`joiada`) em Jr: caps. 29
- Jonas (`jonas`) em 2Rs: caps. 14
- Jonas (`jonas`) em Mt: caps. 12, 16
- Jonas (`jonas`) em Lc: caps. 11
- Jonas (`jonas`) em Jo: caps. 1
- Jônatas (`jonatas`) em Jz: caps. 18
- Jônatas (`jonatas`) em 2Sm: caps. 1, 4, 9, 15, 17, 21, 23
- Jônatas (`jonatas`) em 1Rs: caps. 1
- Jônatas (`jonatas`) em 1Cr: caps. 2, 8–11, 20, 27
- Jônatas (`jonatas`) em 2Cr: caps. 17
- Jônatas (`jonatas`) em Ed: caps. 8, 10
- Jônatas (`jonatas`) em Ne: caps. 12
- Jônatas (`jonatas`) em Jr: caps. 37, 38, 40
- Josafá (`josafa`) em 2Sm: caps. 8, 20
- Josafá (`josafa`) em 1Cr: caps. 11, 15, 18
- Josafá (`josafa`) em Jl: caps. 3
- Josafá (`josafa`) em Mt: caps. 1
- Josias (`josias`) em 1Rs: caps. 13
- Josias (`josias`) em 1Cr: caps. 3, 4
- Josias (`josias`) em Jr: caps. 1, 3, 22, 25–27, 35–37, 45, 46
- Josias (`josias`) em Zc: caps. 6
- Josias (`josias`) em Mt: caps. 1
- Judas Iscariotes (`judas-iscariotes`) em Mc: caps. 3, 14
- Judas Iscariotes (`judas-iscariotes`) em Lc: caps. 6
- Lázaro (`lazaro`) em Lc: caps. 16
- Lia (`lia`) em Rt: caps. 4
- Ló, sobrinho de Abraão (`lo`) em Dt: caps. 2
- Ló, sobrinho de Abraão (`lo`) em Sl: caps. 83
- Ló, sobrinho de Abraão (`lo`) em Lc: caps. 17
- Ló, sobrinho de Abraão (`lo`) em 2Pe: caps. 2
- Manassés (`manasses`) em Gn: caps. 41, 46, 48, 50
- Manassés (`manasses`) em Nm: caps. 1, 2, 7, 10, 13, 26, 27, 32, 34, 36
- Manassés (`manasses`) em Dt: caps. 3, 4, 29, 33, 34
- Manassés (`manasses`) em Js: caps. 1, 4, 12–14, 16–18, 20–22
- Manassés (`manasses`) em Jz: caps. 1, 6, 7, 11, 12, 18
- Manassés (`manasses`) em 1Rs: caps. 4
- Manassés (`manasses`) em 1Cr: caps. 3, 5–7, 9, 12, 26, 27
- Manassés (`manasses`) em Ed: caps. 10
- Manassés (`manasses`) em Sl: caps. 60, 80, 108
- Manassés (`manasses`) em Is: caps. 9
- Manassés (`manasses`) em Ez: caps. 48
- Manassés (`manasses`) em Mt: caps. 1
- Manassés (`manasses`) em Ap: caps. 7
- Mardoqueu (`mardoqueu`) em Ed: caps. 2
- Mardoqueu (`mardoqueu`) em Ne: caps. 7
- Maria Madalena (`maria-madalena`) em Mt: caps. 27, 28
- Maria Madalena (`maria-madalena`) em Mc: caps. 15, 16
- Mateus (Levi) (`mateus`) em Mc: caps. 3
- Mateus (Levi) (`mateus`) em Lc: caps. 6
- Mateus (Levi) (`mateus`) em At: caps. 1
- Mical (`mical`) em 1Cr: caps. 15
- Miqueias (`miqueias`) em Jr: caps. 26, 36
- Miriã (`miria`) em Nm: caps. 12, 20, 26
- Miriã (`miria`) em Dt: caps. 24
- Miriã (`miria`) em 1Cr: caps. 4, 6
- Miriã (`miria`) em Mq: caps. 6
- Moisés (`moises`) em Js: caps. 1, 3, 4, 8, 9, 11–14, 17, 18, 20–24
- Moisés (`moises`) em Jz: caps. 1, 3, 4
- Moisés (`moises`) em 1Sm: caps. 12
- Moisés (`moises`) em 1Rs: caps. 2, 8
- Moisés (`moises`) em 2Rs: caps. 14, 18, 21, 23
- Moisés (`moises`) em 1Cr: caps. 6, 15, 21–23, 26
- Moisés (`moises`) em 2Cr: caps. 1, 5, 8, 23–25, 30, 33–35
- Moisés (`moises`) em Ed: caps. 3, 6, 7
- Moisés (`moises`) em Ne: caps. 1, 8–10, 13
- Moisés (`moises`) em Is: caps. 63
- Moisés (`moises`) em Jr: caps. 15
- Moisés (`moises`) em Dn: caps. 9
- Moisés (`moises`) em Mq: caps. 6
- Moisés (`moises`) em Ml: caps. 4
- Moisés (`moises`) em Mt: caps. 8, 17, 19, 22, 23
- Moisés (`moises`) em Mc: caps. 1, 7, 9, 10, 12
- Moisés (`moises`) em Lc: caps. 2, 5, 9, 16, 20, 24
- Moisés (`moises`) em Jo: caps. 1, 3, 5–9
- Moisés (`moises`) em At: caps. 3, 6, 7, 13, 15, 21, 26, 28
- Moisés (`moises`) em Rm: caps. 5, 9, 10
- Moisés (`moises`) em 1Co: caps. 9, 10
- Moisés (`moises`) em 2Co: caps. 3
- Moisés (`moises`) em 2Tm: caps. 3
- Moisés (`moises`) em Jd: caps. 1
- Moisés (`moises`) em Ap: caps. 15
- Naamã (`naama`) em Gn: caps. 46
- Naamã (`naama`) em Nm: caps. 26
- Naamã (`naama`) em 1Cr: caps. 8
- Naamã (`naama`) em Lc: caps. 4
- Nabucodonosor (`nabucodonosor`) em 1Cr: caps. 6
- Nabucodonosor (`nabucodonosor`) em 2Cr: caps. 36
- Nabucodonosor (`nabucodonosor`) em Ed: caps. 1, 2, 5, 6
- Nabucodonosor (`nabucodonosor`) em Ne: caps. 7
- Nabucodonosor (`nabucodonosor`) em Et: caps. 2
- Nabucodonosor (`nabucodonosor`) em Ez: caps. 26, 29, 30
- Natã (`nata`) em 1Rs: caps. 1, 4
- Natã (`nata`) em 1Cr: caps. 2, 3, 11, 14, 17, 29
- Natã (`nata`) em 2Cr: caps. 9, 29
- Natã (`nata`) em Ed: caps. 8, 10
- Natã (`nata`) em Sl: títulos dos salmos 51
- Natã (`nata`) em Zc: caps. 12
- Natã (`nata`) em Lc: caps. 3
- Natanael (`natanael`) em Nm: caps. 1, 2, 7, 10
- Natanael (`natanael`) em 1Cr: caps. 2, 15, 24, 26
- Natanael (`natanael`) em 2Cr: caps. 17, 35
- Natanael (`natanael`) em Ed: caps. 10
- Natanael (`natanael`) em Ne: caps. 12
- Naum (`naum`) em Lc: caps. 3
- Neemias (`neemias`) em Ed: caps. 2
- Noé (`noe`) em 1Cr: caps. 1
- Noé (`noe`) em Is: caps. 54
- Noé (`noe`) em Ez: caps. 14
- Noé (`noe`) em Mt: caps. 24
- Noé (`noe`) em Lc: caps. 3, 17
- Noé (`noe`) em Hb: caps. 11
- Noé (`noe`) em 1Pe: caps. 3
- Noé (`noe`) em 2Pe: caps. 2
- Obadias (`obadias`) em 1Rs: caps. 18
- Obadias (`obadias`) em 1Cr: caps. 3, 7–9, 12, 27
- Obadias (`obadias`) em 2Cr: caps. 17, 34
- Obadias (`obadias`) em Ed: caps. 8
- Obadias (`obadias`) em Ne: caps. 10, 12
- Obede (`obede`) em 2Cr: caps. 15, 23, 28
- Oseias (`oseias`) em Nm: caps. 13
- Oseias (`oseias`) em 2Rs: caps. 15, 17, 18
- Oseias (`oseias`) em 1Cr: caps. 27
- Oseias (`oseias`) em Ne: caps. 10
- Oseias (`oseias`) em Rm: caps. 9
- Otniel (`otniel`) em 1Cr: caps. 4, 27
- Pedro (`pedro`) em Lc: caps. 5, 6, 8, 9, 12, 18, 22, 24
- Pedro (`pedro`) em Jo: caps. 1, 6, 13, 18, 20, 21
- Pedro (`pedro`) em 1Co: caps. 1, 3, 9, 15
- Pôncio Pilatos (`pilatos`) em At: caps. 4
- Pôncio Pilatos (`pilatos`) em 1Tm: caps. 6
- Raabe (`raabe`) em Jó: caps. 9, 26
- Raabe (`raabe`) em Sl: caps. 87, 89
- Raabe (`raabe`) em Is: caps. 30, 51
- Raquel (`raquel`) em Rt: caps. 4
- Raquel (`raquel`) em 1Sm: caps. 10
- Raquel (`raquel`) em Jr: caps. 31
- Raquel (`raquel`) em Mt: caps. 2
- Rebeca (`rebeca`) em Rm: caps. 9
- Roboão (`roboao`) em 1Cr: caps. 3
- Roboão (`roboao`) em 2Cr: caps. 9–13
- Roboão (`roboao`) em Mt: caps. 1
- Rute (`rute`) em Mt: caps. 1
- Salomão (`salomao`) em 2Sm: caps. 5, 12
- Salomão (`salomao`) em 2Rs: caps. 21, 23–25
- Salomão (`salomao`) em Ed: caps. 2
- Salomão (`salomao`) em Ne: caps. 7, 11–13
- Salomão (`salomao`) em Ct: caps. 1, 3, 8
- Salomão (`salomao`) em Jr: caps. 52
- Salomão (`salomao`) em Mt: caps. 1, 6, 12
- Salomão (`salomao`) em Lc: caps. 11, 12
- Salomão (`salomao`) em Jo: caps. 10
- Salomão (`salomao`) em At: caps. 3, 5, 7
- Samuel (`samuel`) em Nm: caps. 34
- Samuel (`samuel`) em 1Cr: caps. 6, 7, 9, 11, 26, 29
- Samuel (`samuel`) em 2Cr: caps. 35
- Samuel (`samuel`) em Sl: caps. 99
- Samuel (`samuel`) em Jr: caps. 15
- Samuel (`samuel`) em At: caps. 3, 13
- Samuel (`samuel`) em Hb: caps. 11
- Sansão (`sansao`) em Hb: caps. 11
- Sara (`sara`) em Ed: caps. 10
- Sara (`sara`) em Is: caps. 51
- Sara (`sara`) em Rm: caps. 4, 9
- Sara (`sara`) em Hb: caps. 11
- Sara (`sara`) em 1Pe: caps. 3
- Saul (`saul`) em Gn: caps. 36, 46
- Saul (`saul`) em Êx: caps. 6
- Saul (`saul`) em Nm: caps. 26
- Saul (`saul`) em 2Sm: caps. 1–7, 9, 12, 16, 19, 21, 22
- Saul (`saul`) em 1Cr: caps. 1, 4–6, 8–13, 15, 26
- Saul (`saul`) em Sl: títulos dos salmos 18, 52, 54, 57, 59, 142
- Saul (`saul`) em Is: caps. 10
- Saul (`saul`) em At: caps. 13
- Silas (Silvano) (`silas`) em 2Co: caps. 1
- Silas (Silvano) (`silas`) em 2Ts: caps. 1
- Simeão, o do templo (`simeao-templo`) em Gn: caps. 29, 34, 35, 42, 43, 46, 48, 49
- Simeão, o do templo (`simeao-templo`) em Êx: caps. 1, 6
- Simeão, o do templo (`simeao-templo`) em Nm: caps. 1, 2, 7, 10, 13, 25, 26, 34
- Simeão, o do templo (`simeao-templo`) em Dt: caps. 27
- Simeão, o do templo (`simeao-templo`) em Js: caps. 19, 21
- Simeão, o do templo (`simeao-templo`) em Jz: caps. 1
- Simeão, o do templo (`simeao-templo`) em 1Cr: caps. 2, 4, 6, 12
- Simeão, o do templo (`simeao-templo`) em 2Cr: caps. 15, 34
- Simeão, o do templo (`simeao-templo`) em Ed: caps. 10
- Simeão, o do templo (`simeao-templo`) em Ez: caps. 48
- Simeão, o do templo (`simeao-templo`) em At: caps. 13
- Simeão, o do templo (`simeao-templo`) em Ap: caps. 7
- Sofonias (`sofonias`) em 2Rs: caps. 25
- Sofonias (`sofonias`) em 1Cr: caps. 6
- Sofonias (`sofonias`) em Jr: caps. 21, 29, 37, 52
- Sofonias (`sofonias`) em Zc: caps. 6
- Tamar, nora de Judá (`tamar`) em Rt: caps. 4
- Tamar, nora de Judá (`tamar`) em 2Sm: caps. 13, 14
- Tamar, nora de Judá (`tamar`) em 1Cr: caps. 2, 3
- Tamar, nora de Judá (`tamar`) em Ez: caps. 47, 48
- Tamar, nora de Judá (`tamar`) em Mt: caps. 1
- Timóteo (`timoteo`) em At: caps. 16–20
- Timóteo (`timoteo`) em Rm: caps. 16
- Timóteo (`timoteo`) em 1Co: caps. 4, 16
- Timóteo (`timoteo`) em 1Ts: caps. 1, 3
- Timóteo (`timoteo`) em 2Ts: caps. 1
- Tíquico (`tiquico`) em At: caps. 20
- Tíquico (`tiquico`) em 2Tm: caps. 4
- Tíquico (`tiquico`) em Tt: caps. 3
- Tobias, o amonita (`tobias-amonita`) em 2Cr: caps. 17
- Tobias, o amonita (`tobias-amonita`) em Ed: caps. 2
- Tobias, o amonita (`tobias-amonita`) em Zc: caps. 6
- Tomé (`tome`) em Mt: caps. 10
- Tomé (`tome`) em Mc: caps. 3
- Tomé (`tome`) em Lc: caps. 6
- Tomé (`tome`) em At: caps. 1
- Urias, o heteu (`urias`) em 2Rs: caps. 16
- Urias, o heteu (`urias`) em 1Cr: caps. 11
- Urias, o heteu (`urias`) em Ed: caps. 8
- Urias, o heteu (`urias`) em Ne: caps. 3, 8
- Urias, o heteu (`urias`) em Is: caps. 8
- Urias, o heteu (`urias`) em Jr: caps. 26
- Uzias (Azarias) (`uzias`) em 1Cr: caps. 6
- Uzias (Azarias) (`uzias`) em Ed: caps. 10
- Uzias (Azarias) (`uzias`) em Ne: caps. 11
- Uzias (Azarias) (`uzias`) em Zc: caps. 14
- Uzias (Azarias) (`uzias`) em Mt: caps. 1
- Zedequias (`zedequias`) em 1Rs: caps. 22
- Zedequias (`zedequias`) em 1Cr: caps. 3
- Zedequias (`zedequias`) em Ne: caps. 10
- Zorobabel (`zorobabel`) em 1Cr: caps. 3
- Zorobabel (`zorobabel`) em Ne: caps. 7, 12
- Zorobabel (`zorobabel`) em Ag: caps. 1, 2
- Zorobabel (`zorobabel`) em Zc: caps. 4
- Zorobabel (`zorobabel`) em Mt: caps. 1
- Zorobabel (`zorobabel`) em Lc: caps. 3

## Lacunas: capítulos de livros bem cobertos sem o nome

Livros em que o personagem aparece em pelo menos metade dos capítulos; os que faltam podem ser capítulos em que ele age sem ser nomeado. Se quiser mostrá-lo ali, use `include`.

- Arão em Êx: faltam 1–3, 13, 14, 20–23, 25, 26, 33, 36, 37 (26 de 40)
- Assuero em Et: faltam 4, 5 (8 de 10)
- Boaz em Rt: faltam 1 (3 de 4)
- Ciro em Ed: faltam 2, 7–10 (5 de 10)
- Daniel em Dn: faltam 3, 11 (10 de 12)
- Davi em 2Sm: faltam 14 (23 de 24)
- Davi em 1Cr: faltam 1, 5, 8 (26 de 29)
- Epafras em Cl: faltam 2, 3 (2 de 4)
- Epafrodito em Fp: faltam 1, 3 (2 de 4)
- Ester em Et: faltam 1, 3, 10 (7 de 10)
- Hamã em Et: faltam 1, 2, 10 (7 de 10)
- Jeremias em Jr: faltam 2–6, 8–10, 12, 13, 15–17, 22, 23, 31, 41, 48 (34 de 52)
- Jesus em Mt: faltam 6, 25 (26 de 28)
- Jesus em Lc: faltam 12, 15, 16 (21 de 24)
- Jesus em Jo: faltam 15 (20 de 21)
- Jesus em Hb: faltam 1, 5, 9, 11 (9 de 13)
- Jó em Jó: faltam 4, 5, 7, 8, 10, 11, 13–15, 17, 18, 20, 22, 24, 25, 28, 30, 36, 39, 41 (22 de 42)
- Joabe em 2Sm: faltam 1, 4–7, 9, 13, 15, 16, 21, 22 (13 de 24)
- Josué em Js: faltam 16 (23 de 24)
- Mardoqueu em Et: faltam 1 (9 de 10)
- Moisés em Êx: faltam 1, 21–23, 26–29, 37 (31 de 40)
- Moisés em Lv: faltam 2, 3 (25 de 27)
- Moisés em Nm: faltam 22–24 (33 de 36)
- Moisés em Hb: faltam 1, 2, 4–6, 13 (7 de 13)
- Paulo em At: faltam 1–6, 10 (21 de 28)
- Paulo em Cl: faltam 2, 3 (2 de 4)
- Pedro em Mc: faltam 1, 2, 4, 6, 7, 12, 15 (9 de 16)
- Salomão em 1Rs: faltam 13, 15–22 (13 de 22)
- Samuel em 1Sm: faltam 5, 6, 14, 17, 18, 20–24, 26, 27, 29–31 (16 de 31)
- Saul em 1Sm: faltam 1–8, 12, 30 (21 de 31)
- Tiago, filho de Alfeu em Mc: faltam 2, 4, 7, 8, 11, 12 (10 de 16)
- Timóteo em Fp: faltam 3, 4 (2 de 4)

## Conferência PT × EN (Bíblia Livre × KJV)

Diferenças entre as duas buscas. Costumam ser grafia (aliases) ou diferença de texto entre as versões; não entram no JSON.

- Acaz em Mt: só na Bíblia Livre: 1
- Adão em Gn: só na KJV: 3
- Barnabé em At: só na KJV: 9
- Bate-Seba em 2Sm: só na Bíblia Livre: 11, 12
- Bate-Seba em 1Rs: só na Bíblia Livre: 1, 2
- Bezalel em Êx: só na Bíblia Livre: 31, 35–38
- Bezalel em 2Cr: só na Bíblia Livre: 1
- Elias em Tg: só na Bíblia Livre: 5
- Enoque em Gn: só na Bíblia Livre: 25, 46
- Estéfanas em 1Co: só na KJV: 1
- Febe em Rm: só na Bíblia Livre: 16
- Félix, governador em At: só na Bíblia Livre: 24, 25
- Festo, governador em At: só na Bíblia Livre: 24–26
- Filipe, o apóstolo em Jo: só na Bíblia Livre: 1, 6, 12, 14
- Filipe, o evangelista em At: só na Bíblia Livre: 1, 6, 8
- Hananias, filho de Azur em Jr: só na Bíblia Livre: 28, 37
- Hirão em 2Cr: só na Bíblia Livre: 2, 4, 8, 9
- Isabel em Lc: só na Bíblia Livre: 1
- Jeroboão II em Os: só na KJV: 1
- Jesus em Mt: só na Bíblia Livre: 5
- Jesus em Mc: só na Bíblia Livre: 4
- Jesus em Lc: só na Bíblia Livre: 1, 11, 21
- Jesus em Hb: só na Bíblia Livre: 8
- Joabe em 1Cr: só na Bíblia Livre: 6
- João, o apóstolo em Gl: só na Bíblia Livre: 2
- João, o apóstolo em Ap: só na Bíblia Livre: 1, 21, 22
- João Batista em Mt: só na Bíblia Livre: 4, 9, 10, 21
- João Batista em Jo: só na Bíblia Livre: 1, 3–5, 10, 21
- João Marcos em At: só na Bíblia Livre: 1, 3, 4, 8, 10, 11, 13, 18, 19
- Joaquim (Jeconias) em Jr: só na Bíblia Livre: 24, 27–29, 36
- Joaquim (Jeconias) em Mt: só na Bíblia Livre: 1
- José de Arimateia em Mc: só na Bíblia Livre: 6
- Josué em Nm: só na Bíblia Livre: 13
- Josué em Dt: só na Bíblia Livre: 32
- Judas Iscariotes em Jo: só na KJV: 6, 12, 13
- Lucas em Fm: só na Bíblia Livre: 1
- Manassés em 2Rs: só na Bíblia Livre: 10
- Melquisedeque em Hb: só na Bíblia Livre: 5–7
- Nabucodonosor em Jr: só na Bíblia Livre: 21, 22, 24, 25, 32, 35, 37, 43, 44, 46, 49–52
- Nadabe e Abiú em Êx: só na Bíblia Livre: 24
- Paulo em At: só na Bíblia Livre: 7–9, 11, 12
- Pôncio Pilatos em Mt: só na KJV: 27
- Priscila e Áquila em Rm: só na KJV: 16
- Raabe em Mt: só na Bíblia Livre: 1
- Sambalate, o horonita em Ne: só na Bíblia Livre: 4, 6
- Simeão, o do templo em Lc: só na Bíblia Livre: 2, 3
- Timóteo em Fp: só na Bíblia Livre: 1, 2
- Timóteo em Cl: só na Bíblia Livre: 1
- Tobias, o amonita em Ne: só na Bíblia Livre: 2, 6, 7, 13
- Urias, o heteu em Mt: só na Bíblia Livre: 1
- Zacarias, pai de João Batista em Lc: só na Bíblia Livre: 1, 3, 11
- Zaqueu em Lc: só na Bíblia Livre: 19

## A revisar (nome ambíguo, não incluído por padrão)

O mesmo nome serve a mais de um personagem do livro. Decida com `assign` em `people-chapters-overrides.json` (alias + livro + capítulos → personagem).

| Personagem | Ocorrências pendentes |
|---|---|
| Herodes Antipas (`herodes-antipas`) | 47 |
| Herodes o Grande (`herodes-grande`) | 29 |
| João, o apóstolo (`joao-apostolo`) | 22 |
| João Batista (`joao-batista`) | 22 |
| José de Arimateia (`jose-de-arimateia`) | 19 |
| José, marido de Maria (`jose-marido-de-maria`) | 19 |
| Judas Iscariotes (`judas-iscariotes`) | 21 |
| Maria de Betânia (`maria-de-betania`) | 28 |
| Maria Madalena (`maria-madalena`) | 28 |
| Maria, mãe de Jesus (`maria-mae-de-jesus`) | 28 |
| Pedro (`pedro`) | 32 |
| Simão, o zelote (`simao-zelote`) | 48 |
| Tadeu (Judas, filho de Tiago) (`tadeu`) | 18 |
| Tiago, filho de Alfeu (`tiago-alfeu`) | 13 |
| Tiago, o líder da igreja de Jerusalém (`tiago-jerusalem`) | 7 |
| Tiago, filho de Zebedeu (`tiago-zebedeu`) | 13 |

### "Herodes" em Mt — candidatos: `herodes-grande`, `herodes-antipas`

- 2:1,3,7,12,13,15,16,19,22 (9×) — «…ido em Belém da Judeia, nos dias do rei Herodes, eis que vieram uns magos do oriente a…»
- 14:1,3,5,6,6 (5×) — «…Naquele tempo Herodes, o tetrarca, ouviu relato a respeito de…»
- 22:16 (1×) — «…ípulos, juntamente com os apoiadores de Herodes, e perguntaram: Mestre, bem sabemos que…»

### "Herodes" em Mc — candidatos: `herodes-antipas`

- 6:14,16,17,18,20,21,22 (7×) — «…O rei Herodes ouviu falar disso (porque o nome de Jes…»
- 8:15 (1×) — «…o fermento dos fariseus e o fermento de Herodes.…»

### "Herodes" em Lc — candidatos: `herodes-grande`, `herodes-antipas`

- 1:5 (1×) — «…Houve nos dias de Herodes, rei da Judeia, um sacerdote chamado Za…»
- 3:1,19,19 (3×) — «…Pôncio Pilatos o governador da Judeia, Herodes tetraca da Galileia, e seu irmão Filipe…»
- 8:3 (1×) — «…e Joana, a mulher de Cuza, mordomo de Herodes; e Susana, e muitas outras, que lhe ser…»
- 9:7,9 (2×) — «…E o tetrarca Herodes ouvia falar todas as coisas que ele faz…»
- 13:31 (1×) — «…izendo-lhe: Sai, e vai-te daqui, porque Herodes quer te matar.…»
- 23:7,7,8,11,12,15 (6×) — «…E quando soube que era da jurisdição de Herodes, ele o entregou a Herodes, que naqueles…»

### "Herodes" em At — candidatos: `herodes-antipas`

- 4:27 (1×) — «…ao qual tu ungiste, se ajuntaram, tanto Herodes, como Pôncio Pilatos, com os gentios e…»
- 12:1,6,11,19,20,20,21 (7×) — «…E por aquele mesmo tempo o rei Herodes pôs as mãos para maltratar a alguns da…»
- 13:1 (1×) — «…tinha sido criado na infância junto com Herodes o Tetrarca, e Saulo.…»
- 23:35 (1×) — «…E mandou que o guardassem no palácio de Herodes.…»

### "José" em Mt — candidatos: `jose-marido-de-maria`, `jose-de-arimateia`

- 1:16,18,19,20,24 (5×) — «…E Jacó gerou a José, o marido de Maria, da qual nasceu Jesu…»
- 2:13,19 (2×) — «…o, eis que um anjo do Senhor apareceu a José em sonho, dizendo: Levanta-te, toma o m…»
- 13:55 (1×) — «…ama sua mãe Maria, e seus irmãos Tiago, José, Simão, e Judas?…»
- 27:56,57,59 (3×) — «…ria Madalena, e Maria mãe de Tiago e de José, e a mãe dos filhos de Zebedeu.…»

### "José" em Lc — candidatos: `jose-marido-de-maria`, `jose-de-arimateia`

- 1:27 (1×) — «…etida em casamento com um homem chamado José, da descendência de Davi; e o nome da v…»
- 2:4,16 (2×) — «…E José também subiu da Galileia, da cidade de…»
- 3:23,24,30 (3×) — «…anos, sendo (como se pensava) filho de José, filho de Eli,…»
- 4:22 (1×) — «…a boca; e diziam: Não é este o filho de José?…»
- 23:50 (1×) — «…E eis que um homem, de nome José, membro do conselho de justiça,sendo ho…»

### "João" em Mc — candidatos: `joao-apostolo`, `joao-batista`

- 1:4,6,9,14,19,29 (6×) — «…João veio a batizar no deserto, e a pregar o…»
- 2:18,18 (2×) — «…Os discípulos de João e os dos fariseus estavam jejuando; ent…»
- 3:17 (1×) — «…Tiago filho de Zebedeu, e João, irmão de Tiago; e pôs-lhes por nome Bo…»
- 5:37 (1×) — «…m o seguisse, a não ser Pedro, Tiago, e João irmão de Tiago.…»
- 6:16,17,18,20 (4×) — «…Herodes ouviu falar disso, falou: Ele é João, de quem cortei a cabeça. Ele ressuscit…»
- 9:2,38 (2×) — «…is, Jesus tomou consigo Pedro, Tiago, e João, e os levou à parte, sozinhos, para um…»
- 10:35,41 (2×) — «…E vieram a ele Tiago e João, filhos de Zebedeu, dizendo-lhe: Mestre…»
- 11:30,32 (2×) — «…O batismo de João era do céu ou dos homens? Respondei-me.…»
- 13:3 (1×) — «…ras, de frente ao templo, Pedro, Tiago, João, e André perguntaram-lhe à parte:…»
- 14:33 (1×) — «…E tomou consigo Pedro, Tiago, e João, e começou a ficar muito apavorado e an…»

### "Judas" em Mt — candidatos: `judas-iscariotes`, `tadeu`

- 13:55 (1×) — «…ia, e seus irmãos Tiago, José, Simão, e Judas?…»
- 26:25,47 (2×) — «…E Judas, o que o traía, perguntou: Por acaso so…»
- 27:3 (1×) — «…Então Judas, o que o havia traído, ao ver que Jesus…»

### "Judas" em Mc — candidatos: `tadeu`

- 6:3 (1×) — «…de Maria, e irmão de Tiago, de José, de Judas, e de Simão? E não estão aqui as suas i…»
- 14:43 (1×) — «…enquanto ele ainda estava falando, veio Judas, que era um dos doze, e com ele uma mul…»

### "Judas" em Lc — candidatos: `tadeu`

- 6:16 (1×) — «…Judas de Tiago, e Judas Iscariotes, o que foi…»
- 22:3,47,48 (3×) — «…E Satanás entrou no Judas que era chamado Iscariotes, que era um…»

### "Judas" em Jo — candidatos: `judas-iscariotes`

- 6:71 (1×) — «…E ele dizia isto de Judas de Simão Iscariotes; porque ele o entre…»
- 12:4 (1×) — «…Então disse Judas de Simão Iscariotes, um de seus discípu…»
- 13:2,26,29 (3×) — «…, o diabo já havia metido no coração de Judas de Simão Iscariotes, que o traísse.…»
- 14:22 (1×) — «…Disse-lhe Judas (não o Iscariotes): Senhor, que há, por…»
- 18:2,3,5 (3×) — «…E também Judas, o que o traía, conhecia aquele lugar;…»

### "Judas" em At — candidatos: `judas-iscariotes`, `tadeu`

- 1:13,16,25 (3×) — «…s, Tiago filho de Alfeu, Simão Zelote e Judas irmão de Tiago.…»
- 5:37 (1×) — «…Depois deste se levantou Judas, o galileu, nos dias do censo; e perver…»
- 9:11 (1×) — «…chamada Direita, e pergunta na casa de Judas por um chamado Saulo, de Tarso; porque…»
- 15:22,27,32 (3×) — «…viados com Paulo e Barnabé a Antioquia: Judas, que tinha por sobrenome Barsabás; e a…»

### "Maria" em Lc — candidatos: `maria-mae-de-jesus`, `maria-madalena`, `maria-de-betania`

- 1:27,30,34,38,39,41,46,56 (8×) — «…ndência de Davi; e o nome da virgem era Maria.…»
- 2:5,16,19,34 (4×) — «…Para se registrar com Maria, com ele prometida em casamento, que es…»
- 8:2 (1×) — «…e espíritos malignos e de enfermidades: Maria, chamada Madalena, da qual saíram sete…»
- 10:39,42 (2×) — «…E esta tinha uma irmã, chamada Maria, a qual, sentando-se também aos pés de…»
- 24:10 (1×) — «…E eram Maria Madalena, e Joana, e Maria mãe de Tiago, e as outras que estavam c…»

### "Maria" em Jo — candidatos: `maria-mae-de-jesus`, `maria-madalena`, `maria-de-betania`

- 11:1,2,19,20,28,31,32,45 (8×) — «…m certo Lázaro, de Betânia, a aldeia de Maria e de sua irmã Marta.…»
- 12:3 (1×) — «…Tomando então Maria um arrátel de óleo perfumado de nardo p…»
- 19:25 (1×) — «…de Jesus, sua mãe, e a irmã de sua mãe, Maria mulher de Cleofas, e Maria Madalena.…»
- 20:11,16 (2×) — «…E Maria estava fora chorando junto ao sepulcro.…»

### "Simão" em Mt — candidatos: `pedro`, `simao-zelote`

- 4:18 (1×) — «…to ao mar da Galileia, viu dois irmãos: Simão, chamado Pedro, e seu irmão André, lanç…»
- 10:2,4 (2×) — «…s doze apóstolos são estes: o primeiro, Simão, chamado Pedro, e seu irmão André; Tiag…»
- 13:55 (1×) — «…a mãe Maria, e seus irmãos Tiago, José, Simão, e Judas?…»
- 16:17 (1×) — «…E Jesus lhe replicou: Bendito és tu, Simão, filho de Jonas; pois não foi carne e s…»
- 17:25 (1×) — «…us o antecipou, dizendo: Que te parece, Simão? De quem os reis da terra cobram tribut…»
- 26:6 (1×) — «…nto Jesus estava em Betânia, na casa de Simão o leproso,…»
- 27:32 (1×) — «…ncontraram um homem de Cirene, por nome Simão; e obrigaram-no a levar sua cruz.…»

### "Simão" em Mc — candidatos: `pedro`, `simao-zelote`

- 1:16,29,30,36 (4×) — «…ndava junto ao mar da Galileia, ele viu Simão e seu irmão André, que lançavam uma red…»
- 3:16,18 (2×) — «…Eram eles: Simão, a quem pôs por nome Pedro;…»
- 6:3 (1×) — «…irmão de Tiago, de José, de Judas, e de Simão? E não estão aqui as suas irmãs conosco…»
- 14:3,37 (2×) — «…E estando ele em Betânia, na casa de Simão o Leproso, sentado à mesa, veio uma mul…»
- 15:21 (1×) — «…E forçaram um Simão cireneu, que estava passando, vindo do…»

### "Simão" em Lc — candidatos: `simao-zelote`

- 4:38,38 (2×) — «…tou-se da sinagoga, e entrou na casa de Simão. A sogra de Simão estava doente de uma…»
- 5:3,4,5,10,10 (5×) — «…ntrou num daqueles barcos, que era o de Simão, e lhe pediu que o afastasse um pouco d…»
- 6:14,15 (2×) — «…Simão, a quem também chamou de Pedro, e seu i…»
- 7:40,43,44 (3×) — «…E Jesus lhe respondeu: “Simão, tenho uma coisa a te dizer”; e ele dis…»
- 22:31,31 (2×) — «…Disse também o Senhor: Simão, Simão; eis que Satanás vos pediu, para…»
- 23:26 (1×) — «…E enquanto o levavam, tomaram a um Simão Cireneu, que vinha do campo, e puseram-…»
- 24:34 (1×) — «…e o Senhor ressuscitou, e já apareceu a Simão.…»

### "Simão" em At — candidatos: `pedro`, `simao-zelote`

- 1:13 (1×) — «…rtolomeu, Mateus, Tiago filho de Alfeu, Simão Zelote e Judas irmão de Tiago.…»
- 8:9,13,18,24 (4×) — «…E havia um certo homem, de nome Simão, que antes naquela cidade usava de magi…»
- 9:43 (1×) — «…ficou muitos dias em Jope, com um certo Simão curtidor.…»
- 10:5,6,17,18,32,32 (6×) — «…a envia homens a Jope, e manda chamar a Simão, que tem por sobrenome Pedro.…»
- 11:13 (1×) — «…alguns homens a Jope, e manda chamar a Simão, que tem por sobrenome Pedro;…»
- 15:14 (1×) — «…Simão informou como primeiro Deus visitou aos…»

### "Tiago" em Mt — candidatos: `tiago-zebedeu`, `tiago-alfeu`

- 4:21 (1×) — «…passando dali, viu outros dois irmãos: Tiago, filho de Zebedeu, e seu irmão João, em…»
- 10:2,3 (2×) — «…imão, chamado Pedro, e seu irmão André; Tiago, filho de Zebedeu, e seu irmão João;…»
- 13:55 (1×) — «…o se chama sua mãe Maria, e seus irmãos Tiago, José, Simão, e Judas?…»
- 17:1 (1×) — «…dias depois, Jesus tomou consigo Pedro, Tiago, e seu irmão João, e os levou a sós a u…»
- 27:56 (1×) — «…estavam Maria Madalena, e Maria mãe de Tiago e de José, e a mãe dos filhos de Zebede…»

### "Tiago" em At — candidatos: `tiago-jerusalem`, `tiago-zebedeu`, `tiago-alfeu`

- 1:13,13,13 (3×) — «…ao cômodo superior, onde ficaram Pedro, Tiago, João, André, Filipe, Tomé, Bartolomeu,…»
- 12:2,17 (2×) — «…E matou a Tiago, o irmão de João, pela espada.…»
- 15:13 (1×) — «…E tendo estes se calado, Tiago respondeu, dizendo: Homens irmãos, ouvi…»
- 21:18 (1×) — «…eguinte, Paulo entrou conosco a casa de Tiago, e todos os anciãos vieram ali.…»

