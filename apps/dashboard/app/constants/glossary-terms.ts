export interface GlossaryTerm {
  keys: string
  name: string
  en: string
  tags: string[]
  body: string
  alias: string
}

export interface GlossarySection {
  id: string
  title: string
  lead: string
  terms: GlossaryTerm[]
}

export const glossarySections: GlossarySection[] = [
  {
    id: 'base',
    title: '01 Базовые понятия',
    lead: 'Каркас индустрии: что такое iGaming, онлайн-казино и как устроен рынок вокруг ставок и азартных игр.',
    terms: [
      {
        keys: 'igaming i-gaming азартные онлайн gambling',
        name: 'iGaming',
        en: 'iGaming',
        tags: [
          'база',
        ],
        body: 'Онлайн-сегмент азартных игр: казино, беттинг, покер, лотереи, fantasy sports и смежные продукты, доступные через веб и приложения.',
        alias: '',
      },
      {
        keys: 'online casino онлайн казино оператор brand',
        name: 'Онлайн-казино',
        en: 'Online casino',
        tags: [
          'база',
        ],
        body: 'Платформа, где игрок регистрируется, депозитит и играет в слоты, live и настольные игры. «Казино» в обзорнике = бренд + сайт + офер игроку.',
        alias: '',
      },
      {
        keys: 'operator оператор brand бренд white label',
        name: 'Оператор',
        en: 'Operator',
        tags: [
          'база',
        ],
        body: 'Компания, которая держит лицензию/бренд, принимает ставки и несёт обязательства перед игроком и регулятором. Может работать на собственном софте или white-label.',
        alias: '',
      },
      {
        keys: 'vertical вертикаль casino sportsbook poker',
        name: 'Вертикаль',
        en: 'Vertical',
        tags: [
          'база',
        ],
        body: 'Направление продукта: casino, sportsbook, poker, lottery, bingo, crash/instant. Один бренд часто совмещает несколько вертикалей.',
        alias: '',
      },
      {
        keys: 'ggr ngr revenue оборот hold',
        name: 'GGR / NGR',
        en: 'Gross / Net Gaming Revenue',
        tags: [
          'деньги',
        ],
        body: 'GGR — ставки минус выигрыши игроков (валовая игровая выручка). NGR — GGR после бонусов, комиссий, chargeback и части операционных корректировок. База для RevShare.',
        alias: 'Рядом: turnover, handle, hold %',
      },
      {
        keys: 'b2c b2b to-business to-consumer',
        name: 'B2C / B2B',
        en: 'Business models',
        tags: [
          'база',
        ],
        body: 'B2C — оператор продаёт игру конечному игроку. B2B — провайдеры игр, платёжки, платформы, агрегаторы продают услуги операторам.',
        alias: '',
      },
      {
        keys: 'geo рынок market jurisdiction юрисдикция',
        name: 'Гео / рынок',
        en: 'Geo / market',
        tags: [
          'legal',
        ],
        body: 'Страна или регион, для которого настроен продукт, платежи, язык, офер и compliance. Один бренд может иметь разные оферы под разные гео.',
        alias: '',
      },
    ],
  },
  {
    id: 'actors',
    title: '02 Роли и участники',
    lead: 'Кто стоит между деньгами игрока и слотом: оператор, провайдер, агрегатор, платёжка, аффилиат.',
    terms: [
      {
        keys: 'player игрок user user id account',
        name: 'Игрок',
        en: 'Player / End user',
        tags: [
          'роль',
        ],
        body: 'Конечный пользователь: регистрация → KYC (часто) → депозит → игра → вывод. В аналитике: FTDs, actives, retention cohort.',
        alias: '',
      },
      {
        keys: 'provider game provider провайдер студия',
        name: 'Провайдер игр',
        en: 'Game provider',
        tags: [
          'роль',
        ],
        body: 'Студия/компания, которая разрабатывает слоты и live-игры и отдаёт их операторам по интеграции (прямая или через агрегатор). Примеры моделей: Pragmatic, NetEnt, Evolution, Hacksaw.',
        alias: '',
      },
      {
        keys: 'aggregator агрегатор softswiss everyMatrix',
        name: 'Агрегатор',
        en: 'Game aggregator',
        tags: [
          'tech',
        ],
        body: 'Посредник: одна интеграция — доступ к десяткам провайдеров. Упрощает запуск каталога, биллинг провайдерам и сертификацию.',
        alias: '',
      },
      {
        keys: 'platform платформа casino platform turnkey',
        name: 'Платформа казино',
        en: 'Casino platform',
        tags: [
          'tech',
        ],
        body: 'Технический стек оператора: аккаунты, кошелёк, бонусы, CRM, back-office, интеграции игр и платежей. Может быть in-house, turnkey или white-label.',
        alias: '',
      },
      {
        keys: 'psp payment provider платёжка acquiring',
        name: 'Платёжный провайдер (PSP)',
        en: 'Payment service provider',
        tags: [
          'деньги',
        ],
        body: 'Принимает депозиты и проводит выплаты. В gambling часто отдельный risk/MCC, local methods, crypto rails и жёсткий antifraud.',
        alias: '',
      },
      {
        keys: 'affiliate аффилиат партнёр publisher',
        name: 'Аффилиат / паблишер',
        en: 'Affiliate / Publisher',
        tags: [
          'роль',
        ],
        body: 'Сайт или медиа, которое приводит игроков по партнёрской ссылке и получает CPA / RevShare / Hybrid. Обзорник казино — типичный affiliate-продукт.',
        alias: '',
      },
      {
        keys: 'regulator регулятор licensing authority',
        name: 'Регулятор',
        en: 'Regulator',
        tags: [
          'legal',
        ],
        body: 'Орган, выдающий лицензию и контролирующий оператора: MGA, UKGC, Curacao (исторически), Ontario iGaming, и т.д. Задаёт правила рекламы, RG, отчётности.',
        alias: '',
      },
      {
        keys: 'softswiss oracle oddsfeed odds provider',
        name: 'Odds / data provider',
        en: 'Odds feed',
        tags: [
          'tech',
        ],
        body: 'Поставщик котировок и спортивных данных для sportsbook. Не путать с game provider.',
        alias: '',
      },
    ],
  },
  {
    id: 'license',
    title: '03 Лицензии и гео',
    lead: 'Легальность, «серые» рынки, зеркала и то, что проверяют в обзоре казино первым делом.',
    terms: [
      {
        keys: 'license лицензия mga ukgc curacao',
        name: 'Лицензия',
        en: 'Gambling licence',
        tags: [
          'legal',
        ],
        body: 'Разрешение регулятора на приём ставок. Важны: юрисдикция, номер, статус, на кого выдана, какие вертикали покрывает. «Лицензия Curacao» ≠ UKGC по уровню защиты игрока.',
        alias: '',
      },
      {
        keys: 'regulated market регулируемый рынок',
        name: 'Регулируемый рынок',
        en: 'Regulated market',
        tags: [
          'legal',
        ],
        body: 'Страна с локальной лицензией и жёсткими правилами (UK, SE, NL, Ontario…). Реклама, бонусы и KYC строго ограничены.',
        alias: '',
      },
      {
        keys: 'grey market серый рынок offshore',
        name: 'Серый рынок',
        en: 'Grey market',
        tags: [
          'риск',
        ],
        body: 'Рынок без ясной локальной лицензии, где операторы работают с offshore-лицензией. Выше legal/payment risk, ниже барьер входа.',
        alias: '',
      },
      {
        keys: 'mirror зеркало domain mirror site',
        name: 'Зеркало',
        en: 'Mirror',
        tags: [
          'продукт',
        ],
        body: 'Альтернативный домен того же казино при блокировках/фильтрах. В обзорах важно отличать официальное зеркало от фишинга.',
        alias: '',
      },
      {
        keys: 'whitelist blacklist белый чёрный список',
        name: 'Whitelist / Blacklist',
        en: 'Trust lists',
        tags: [
          'риск',
        ],
        body: 'Списки доверенных и проблемных брендов у обзорника/коммьюнити. Blacklist обычно за невыплаты, скам, подмену правил.',
        alias: '',
      },
      {
        keys: 'geo-block геоблок vpn restricted',
        name: 'Геоблок',
        en: 'Geo-restriction',
        tags: [
          'legal',
        ],
        body: 'Ограничение доступа по IP/стране. Обход через VPN часто нарушает T&C и может привести к конфискации выигрыша.',
        alias: '',
      },
    ],
  },
  {
    id: 'games',
    title: '04 Игры',
    lead: 'Каталог вертикали casino: слоты, live, настольные, instant/crash и соседние форматы.',
    terms: [
      {
        keys: 'slot слот автомат online slot',
        name: 'Слот',
        en: 'Slot',
        tags: [
          'игры',
        ],
        body: 'Игровой автомат с барабанами/сеткой и RNG. Подтипы: classic, video, megaways, cluster, hold & win, bonus buy.',
        alias: '',
      },
      {
        keys: 'live casino live dealer живое казино',
        name: 'Live casino',
        en: 'Live dealer',
        tags: [
          'игры',
        ],
        body: 'Игры с живым дилером и видеопотоком: рулетка, блэкджек, баккара, game shows. Провайдеры: Evolution, Pragmatic Live и др.',
        alias: '',
      },
      {
        keys: 'table games настольные blackjack roulette baccarat',
        name: 'Настольные игры',
        en: 'Table games',
        tags: [
          'игры',
        ],
        body: 'Блэкджек, рулетка, баккара, покер против дома — RNG или live. Ключевой параметр: house edge / RTP.',
        alias: '',
      },
      {
        keys: 'crash instant plinko mines dice aviator',
        name: 'Crash / Instant games',
        en: 'Crash, Mines, Plinko, Dice',
        tags: [
          'игры',
        ],
        body: 'Быстрые игры с коротким раундом. Часто с provably fair. Высокая вовлечённость, простая UX, популярны в crypto-казино.',
        alias: '',
      },
      {
        keys: 'jackpot джекпот progressive',
        name: 'Джекпот',
        en: 'Jackpot / Progressive',
        tags: [
          'деньги',
        ],
        body: 'Крупный приз. Progressive растёт от ставок сети игроков. Local vs network jackpot.',
        alias: '',
      },
      {
        keys: 'bonus buy покупка бонуса feature buy',
        name: 'Bonus Buy',
        en: 'Feature / Bonus buy',
        tags: [
          'игры',
        ],
        body: 'Покупка входа в бонусный раунд слота за N× ставки. В ряде регуляций запрещён.',
        alias: '',
      },
      {
        keys: 'demo демо fun play',
        name: 'Демо-режим',
        en: 'Demo / Fun play',
        tags: [
          'игры',
        ],
        body: 'Игра на виртуальный баланс без депозита. Удобно для обзоров слотов и обучения механикам.',
        alias: '',
      },
      {
        keys: 'sportsbook беттинг betting odds',
        name: 'Sportsbook',
        en: 'Sports betting',
        tags: [
          'игры',
        ],
        body: 'Приём ставок на спорт/киберспорт. Prematch, live, ординары, экспрессы, маржа букмекера.',
        alias: '',
      },
    ],
  },
  {
    id: 'math',
    title: '05 Математика игр',
    lead: 'Цифры, которые объясняют «честность» и ощущение игры — без магии «горячий слот».',
    terms: [
      {
        keys: 'rtp return to player отдача',
        name: 'RTP',
        en: 'Return to Player',
        tags: [
          'math',
        ],
        body: 'Теоретический процент возврата игроку на длинной дистанции. RTP 96% ≈ house edge 4%. У оператора иногда несколько конфигураций RTP одного слота.',
        alias: '',
      },
      {
        keys: 'volatility variance волатильность дисперсия',
        name: 'Волатильность',
        en: 'Volatility / Variance',
        tags: [
          'math',
        ],
        body: 'Насколько «рваный» профиль выплат: low — частые мелкие, high — редкие крупные. Влияет на банкролл и ощущение слота сильнее, чем разница RTP 0.5%.',
        alias: '',
      },
      {
        keys: 'rng random number generator генератор',
        name: 'RNG',
        en: 'Random Number Generator',
        tags: [
          'tech',
        ],
        body: 'Генератор случайных чисел, определяющий исход спина/раздачи. Сертифицируется лабораториями (GLI, eCOGRA, iTech Labs и др.).',
        alias: '',
      },
      {
        keys: 'house edge преимущество казино margin',
        name: 'House edge',
        en: 'House edge',
        tags: [
          'math',
        ],
        body: 'Математическое преимущество дома: 100% − RTP. В беттинге аналог — маржа линии.',
        alias: '',
      },
      {
        keys: 'hit frequency частота выигрышей',
        name: 'Hit frequency',
        en: 'Hit rate',
        tags: [
          'math',
        ],
        body: 'Как часто любой выигрыш выпадает относительно спинов. Не равен RTP.',
        alias: '',
      },
      {
        keys: 'max win максимальный выигрыш',
        name: 'Max win',
        en: 'Maximum win',
        tags: [
          'деньги',
        ],
        body: 'Потолок выигрыша в слоте, обычно в множителях ставки (например ×10 000). Важен вместе с волатильностью.',
        alias: '',
      },
      {
        keys: 'provably fair доказуемая честность',
        name: 'Provably Fair',
        en: 'Provably fair',
        tags: [
          'tech',
        ],
        body: 'Криптографическая схема (server/client seed + nonce), позволяющая игроку проверить, что исход не подкручивали после ставки. Типично для crypto/instant.',
        alias: '',
      },
      {
        keys: 'gambler\'s fallacy заблуждение игрока hot cold',
        name: 'Заблуждение игрока',
        en: 'Gambler’s fallacy',
        tags: [
          'риск',
        ],
        body: 'Ошибка мышления «после серии проигрышей должен выпасть выигрыш». У независимого RNG прошлые спины не влияют на следующие.',
        alias: '',
      },
    ],
  },
  {
    id: 'bonus',
    title: '06 Бонусы и промо',
    lead: 'То, что пишет маркетинг крупно, и то, что спрятано в T&amp;C мелким шрифтом.',
    terms: [
      {
        keys: 'welcome bonus приветственный бонус',
        name: 'Welcome-бонус',
        en: 'Welcome / Sign-up bonus',
        tags: [
          'бонус',
        ],
        body: 'Пакет на первый депозит(ы): % к депозиту, фриспины, иногда free bet. Главные параметры: сумма, вейджер, срок, max bet, game weighting.',
        alias: '',
      },
      {
        keys: 'wager вейджер отыгрыш playthrough',
        name: 'Вейджер / отыгрыш',
        en: 'Wagering / Playthrough',
        tags: [
          'бонус',
        ],
        body: 'Сколько раз нужно прокрутить бонус (и иногда депозит), прежде чем вывести. Пример: бонус $100 ×35 = $3 500 turnover.',
        alias: '',
      },
      {
        keys: 'freespins фриспины free spins',
        name: 'Фриспины',
        en: 'Free spins',
        tags: [
          'бонус',
        ],
        body: 'Бесплатные вращения на конкретном слоте/ставке. Выигрыш с FS обычно тоже с вейджером.',
        alias: '',
      },
      {
        keys: 'no deposit бездепозитный ndb',
        name: 'Бездепозитный бонус',
        en: 'No deposit bonus',
        tags: [
          'бонус',
        ],
        body: 'Бонус без пополнения. Часто жёсткий вейджер, лимит вывода и строгий KYC. Высокий риск абуза → жёсткие правила.',
        alias: '',
      },
      {
        keys: 'cashback кешбек',
        name: 'Кешбек',
        en: 'Cashback',
        tags: [
          'бонус',
        ],
        body: 'Возврат % от нетто-проигрыша за период. Бывает с вейджером и без (sticky vs real cashback).',
        alias: '',
      },
      {
        keys: 'reload reload bonus повторный',
        name: 'Reload',
        en: 'Reload bonus',
        tags: [
          'бонус',
        ],
        body: 'Бонус на повторный депозит (день недели, VIP-tier, промокод).',
        alias: '',
      },
      {
        keys: 'vip loyalty программа лояльности',
        name: 'VIP / Loyalty',
        en: 'VIP program',
        tags: [
          'бонус',
        ],
        body: 'Уровни лояльности по обороту: кешбек, персональный менеджер, лимиты вывода, подарки. Важно смотреть прозрачность правил.',
        alias: '',
      },
      {
        keys: 'max bet максимальная ставка бонус',
        name: 'Max bet (на бонусе)',
        en: 'Max bet while bonus',
        tags: [
          'риск',
        ],
        body: 'Лимит ставки во время отыгрыша (часто $5). Превышение = аннуляция бонуса и выигрыша.',
        alias: '',
      },
      {
        keys: 'game contribution weighting вклад игр',
        name: 'Game contribution',
        en: 'Weighting',
        tags: [
          'бонус',
        ],
        body: 'Какой % ставки идёт в вейджер: слоты 100%, рулетка 10–20%, некоторые игры 0%. Критично читать в T&C.',
        alias: '',
      },
      {
        keys: 'bonus abuse бонус хантер multi-accounting',
        name: 'Bonus abuse',
        en: 'Bonus hunting / abuse',
        tags: [
          'риск',
        ],
        body: 'Схема извлечения ценности бонусов в обход правил: мультиакки, низкорисковые ставки, арбитраж. Операторы режут через risk/AML правила.',
        alias: '',
      },
    ],
  },
  {
    id: 'pay',
    title: '07 Платежи и KYC',
    lead: 'Деньги входят легко, выходят через правила, лимиты и проверки.',
    terms: [
      {
        keys: 'deposit депозит пополнение',
        name: 'Депозит',
        en: 'Deposit',
        tags: [
          'деньги',
        ],
        body: 'Пополнение игрового баланса. Важны: методы, min/max, комиссии, скорость зачисления, доступность в гео.',
        alias: '',
      },
      {
        keys: 'withdrawal вывод payout cashout',
        name: 'Вывод',
        en: 'Withdrawal / Payout',
        tags: [
          'деньги',
        ],
        body: 'Запрос выплаты. Смотреть: срок обработки, лимиты в день/месяц, обязательный метод = метод депозита, pending/hold.',
        alias: '',
      },
      {
        keys: 'kyc know your customer верификация',
        name: 'KYC',
        en: 'Know Your Customer',
        tags: [
          'legal',
        ],
        body: 'Идентификация личности: паспорт, селфи, proof of address, иногда source of funds. Обычно до крупного вывода или по триггеру риска.',
        alias: '',
      },
      {
        keys: 'aml anti money laundering противодействие',
        name: 'AML',
        en: 'Anti-Money Laundering',
        tags: [
          'legal',
        ],
        body: 'Процедуры против отмывания: мониторинг транзакций, SoF/SoW, санкционные списки, reporting.',
        alias: '',
      },
      {
        keys: 'chargeback чарджбек',
        name: 'Chargeback',
        en: 'Chargeback',
        tags: [
          'риск',
        ],
        body: 'Оспаривание платежа через банк. В gambling высокий риск → жёсткие правила верификации и иногда запрет карт.',
        alias: '',
      },
      {
        keys: 'crypto cryptocurrency крипта bitcoin usdt',
        name: 'Crypto-платежи',
        en: 'Crypto rails',
        tags: [
          'деньги',
        ],
        body: 'BTC, ETH, USDT и др. Быстрые выводы, меньше банковского friction, свои риски: волатильность, необратимость, compliance.',
        alias: '',
      },
      {
        keys: 'pending холд обработка',
        name: 'Pending / Hold',
        en: 'Pending withdrawal',
        tags: [
          'продукт',
        ],
        body: 'Статус «в обработке». Иногда можно отменить и вернуть в баланс (и снова проиграть). В честных брендах срок прозрачен.',
        alias: '',
      },
      {
        keys: 'closed loop закрытый контур',
        name: 'Closed-loop withdrawals',
        en: 'Same-method payout',
        tags: [
          'legal',
        ],
        body: 'Правило: выводить туда же, откуда депозит — антифрод и AML-требование многих лицензий.',
        alias: '',
      },
    ],
  },
  {
    id: 'aff',
    title: '08 Affiliate-маркетинг',
    lead: 'Как обзорник зарабатывает и какие метрики смотрят оператор и паблишер.',
    terms: [
      {
        keys: 'cpa cost per acquisition стоимость',
        name: 'CPA',
        en: 'Cost Per Acquisition',
        tags: [
          'affiliate',
        ],
        body: 'Фикс за квалифицированного игрока (обычно FTD). Высокий чек, но жёсткие QUAL-условия и baseline.',
        alias: '',
      },
      {
        keys: 'revshare revenue share процент',
        name: 'RevShare',
        en: 'Revenue share',
        tags: [
          'affiliate',
        ],
        body: '% от NGR (иногда GGR) игроков паблишера, часто lifetime. Важны: negative carryover, admin fee, бонус-дидакты.',
        alias: '',
      },
      {
        keys: 'hybrid гибрид cpa revshare',
        name: 'Hybrid',
        en: 'CPA + RevShare',
        tags: [
          'affiliate',
        ],
        body: 'Смешанная модель: меньший CPA + меньший % RevShare. Баланс кэша и хвоста.',
        alias: '',
      },
      {
        keys: 'ftd first time deposit первый депозит',
        name: 'FTD',
        en: 'First Time Deposit',
        tags: [
          'affiliate',
        ],
        body: 'Первый депозит игрока. Ключевая конверсия воронки: click → reg → FTD.',
        alias: '',
      },
      {
        keys: 'baseline минимальный депозит qual',
        name: 'Baseline / Qualification',
        en: 'Qualifying criteria',
        tags: [
          'affiliate',
        ],
        body: 'Условия оплаты CPA: min депозит, N депозитов, оборот, отсутствие бонус-абуза, страна из allowlist.',
        alias: '',
      },
      {
        keys: 'negative carryover минус перенос',
        name: 'Negative carryover',
        en: 'NCO',
        tags: [
          'affiliate',
        ],
        body: 'Если когорта в минусе, минус переносится на следующий месяц. Без NCO — «no negative carryover» офер выгоднее паблишеру.',
        alias: '',
      },
      {
        keys: 'tracking трекинг subid clickid postback',
        name: 'Tracking / Postback',
        en: 'S2S / pixel',
        tags: [
          'tech',
        ],
        body: 'Привязка клика к регистрации/FTD: click ID, subID, cookie/S2S postback. Без трекинга нет оплаты.',
        alias: '',
      },
      {
        keys: 'brand deal media buying media buy',
        name: 'Brand deal / Media buy',
        en: 'Direct deals',
        tags: [
          'affiliate',
        ],
        body: 'Прямые размещения (топ-слот, статья, баннер) за фикс или смешанно с CPA. Не путать с чистым performance.',
        alias: '',
      },
      {
        keys: 'seo sem ppc трафик',
        name: 'SEO / SEM трафик',
        en: 'Organic / Paid',
        tags: [
          'маркетинг',
        ],
        body: 'Органика (обзоры, рейтинги, интентные запросы) и платный трафик. Для gambling — жёсткие политики ad networks и локальные запреты рекламы.',
        alias: '',
      },
    ],
  },
  {
    id: 'ops',
    title: '09 Оператор и продукт',
    lead: 'Внутренняя кухня казино: лимиты, CRM, hold, поддержка.',
    terms: [
      {
        keys: 'wallet кошелёк баланс real bonus',
        name: 'Кошелёк',
        en: 'Wallet',
        tags: [
          'tech',
        ],
        body: 'Баланс(ы) игрока: real money, bonus money, locked. Правила списания ставок и приоритет кошельков — часть бонусной логики.',
        alias: '',
      },
      {
        keys: 'crm бонусы сегментация',
        name: 'CRM / Retention',
        en: 'CRM',
        tags: [
          'продукт',
        ],
        body: 'Сегменты, триггерные бонусы, email/push/SMS, VIP-work. Цель — LTV и reactivation.',
        alias: '',
      },
      {
        keys: 'support поддержка live chat',
        name: 'Служба поддержки',
        en: 'Customer support',
        tags: [
          'продукт',
        ],
        body: 'Live chat / email / Telegram. В обзорах: скорость, язык, эскалация по выплатам.',
        alias: '',
      },
      {
        keys: 'table limits лимиты min max bet',
        name: 'Лимиты ставок',
        en: 'Bet limits',
        tags: [
          'продукт',
        ],
        body: 'Min/max ставка на игру или стол. У VIP могут быть выше.',
        alias: '',
      },
      {
        keys: 'gamification геймификация missions',
        name: 'Геймификация',
        en: 'Missions / Shop',
        tags: [
          'продукт',
        ],
        body: 'Миссии, уровни, магазин очков, турниры слотов — механики удержания без «классического» бонуса.',
        alias: '',
      },
      {
        keys: 'tournament турнир races',
        name: 'Турнир / Race',
        en: 'Tournament',
        tags: [
          'продукт',
        ],
        body: 'Соревнование по очкам/множителям на слотах или live. Призовой фонд отдельно от RTP слота.',
        alias: '',
      },
      {
        keys: 'white label вайт лейбл turnkey',
        name: 'White-label',
        en: 'White label / Turnkey',
        tags: [
          'tech',
        ],
        body: 'Готовая платформа под чужим брендом. Быстрый запуск, меньше контроля над стеком и иногда над лицензионной обвязкой.',
        alias: '',
      },
    ],
  },
  {
    id: 'risk',
    title: '10 Риск и compliance',
    lead: 'Защита игрока, антифрод и то, из‑за чего бренд попадает в блэклист.',
    terms: [
      {
        keys: 'responsible gambling rg ответственная игра',
        name: 'Responsible Gambling (RG)',
        en: 'Safer gambling',
        tags: [
          'legal',
        ],
        body: 'Инструменты защиты: лимиты депозита/проигрыша/времени, reality check, self-exclusion, ссылки на помощь.',
        alias: '',
      },
      {
        keys: 'self exclusion самоисключение',
        name: 'Self-exclusion',
        en: 'Self-exclusion',
        tags: [
          'legal',
        ],
        body: 'Добровольная блокировка доступа на срок. В регулируемых рынках — через центральные реестры (GamStop и аналоги).',
        alias: '',
      },
      {
        keys: 'fraud antifraud фрод multi account',
        name: 'Antifraud',
        en: 'Fraud prevention',
        tags: [
          'риск',
        ],
        body: 'Детект мультиакков, VPN/proxy, device fingerprint, коллазии платежей, бонус-абуза.',
        alias: '',
      },
      {
        keys: 'confiscation конфискация void выигрыш',
        name: 'Конфискация / Void',
        en: 'Win voiding',
        tags: [
          'риск',
        ],
        body: 'Аннуляция выигрыша по T&C: нарушен max bet, гео, мультиакк, technical error. Частая причина жалоб в обзорниках.',
        alias: '',
      },
      {
        keys: 'dispute жалоба медиация',
        name: 'Dispute / жалоба',
        en: 'Player complaint',
        tags: [
          'риск',
        ],
        body: 'Конфликт игрок↔казино. Каналы: support → лицензиар / ADR → публичные площадки и обзорники.',
        alias: '',
      },
      {
        keys: 'underage несовершеннолетние age gate',
        name: 'Age gate / 18+',
        en: 'Age verification',
        tags: [
          'legal',
        ],
        body: 'Запрет несовершеннолетним. В сильных регуляциях — жёсткая age verification до игры.',
        alias: '',
      },
    ],
  },
  {
    id: 'content',
    title: '11 Контент и обзорники',
    lead: 'Словарь редакции: как мы описываем казино и что считается качеством материала.',
    terms: [
      {
        keys: 'review обзор casino review',
        name: 'Обзор казино',
        en: 'Casino review',
        tags: [
          'контент',
        ],
        body: 'Структурированная оценка бренда: лицензия, платежи, бонусы, игры, UX, поддержка, риски. Должен помогать решению «играть / не играть».',
        alias: '',
      },
      {
        keys: 'rating рейтинг score methodology',
        name: 'Рейтинг',
        en: 'Rating / Score',
        tags: [
          'контент',
        ],
        body: 'Сводный балл по методике. Прозрачная формула важнее «красивой цифры».',
        alias: '',
      },
      {
        keys: 'toc toc offer топ офер cta',
        name: 'Офер / CTA',
        en: 'Offer / CTA',
        tags: [
          'affiliate',
        ],
        body: 'Партнёрское предложение в карточке: бонус, кнопка перехода, трекинговая ссылка. Должен совпадать с реальным лендингом.',
        alias: '',
      },
      {
        keys: 'eeat экспертность trust',
        name: 'E-E-A-T сигналы',
        en: 'Experience, Expertise, Authority, Trust',
        tags: [
          'контент',
        ],
        body: 'Доверие к материалу: автор, методика, даты апдейта, источники, честные минусы, пометки рекламы.',
        alias: '',
      },
      {
        keys: 'disclaimer дисклеймер 18+',
        name: 'Дисклеймер',
        en: 'Disclaimer',
        tags: [
          'legal',
        ],
        body: '18+, риски, «реклама/партнёрка», гео-ограничения. Обязательный элемент gambling-контента.',
        alias: '',
      },
      {
        keys: 'ugc отзыв user review',
        name: 'UGC / отзывы игроков',
        en: 'User reviews',
        tags: [
          'контент',
        ],
        body: 'Пользовательский контент. Нужна модерация, антифрод и отделение от редакционного рейтинга.',
        alias: '',
      },
    ],
  },
  {
    id: 'schemes',
    title: '12 Схемы взаимодействий',
    lead: 'Кто с кем говорит и куда идут деньги, клики и данные.',
    terms: [],
  },
]

export const glossaryTermCount = glossarySections.reduce((n, s) => n + s.terms.length, 0)
