# Демо-vault провайдера

В Handshake это локальная модель размещения свободного обеспечения. Она не подключена к Mantle, Bybit, блокчейну или кошелькам. Нет подписания транзакций, начисления дохода, APR, комиссий либо обещанного срока возврата. В интерфейсе доходность обозначена «Переменная», начисления — «Не подключено».

## Проверенные источники, 15 октября 2026

- [Страница Mantle Vault на Bybit](https://www.bybit.com/en/earn/mantle-vault/): APR зависит от рыночных условий. У реального продукта есть собственные требования к пользователям и региональной доступности; наличие банков страны в Handshake не означает доступность продукта Bybit для её резидентов.
- [Официальное сообщение Bybit о Mantle Vault, март 2026](https://www.bybit.com/en/press/post/another-month-another-milestone-bybit-earn-s-mantle-vault-more-than-doubles-aum-in-first-quarter-of-2026-blt2bbae5dfc762e3ae): большинство выводов описано как обрабатываемые за 0–3 дня. Это характеристика продукта Bybit в публикации, не гарантия срока и не таймер демо.
- [Официальное руководство Bybit](https://www.bybit.com/en/learn/bybit-guide/mantle-vault-guide): доходность оценочная, есть риски смарт-контрактов, протоколов и ликвидности; вывод может задержаться. Маркетинговые формулировки о защите капитала не считаются гарантией в Handshake.
- [Релиз Mantle от 25 августа 2026, опубликованный от имени Mantle](https://www.prnewswire.com/news-releases/mantle-vault-expands-to-defi-bringing-institutional-grade-rwa-yield-on-chain-with-grove-cian-and-fluxion-302859583.html): отдельное расширение в DeFi с USDC/USDT0, Grove, CIAN и Fluxion также описывает переменную доходность. Его активы, стратегии и условия не смешиваются с версией на Bybit.

Численные ставки из старых публикаций не используются как актуальная доходность. USDT в демо — единица внутреннего учёта, а не подключённый токен USDT0 или доля реального vault.

## Учёт обеспечения

`Доступно для сделок = общее обеспечение − резерв согласованных сделок − active vault − withdrawal-pending vault`.

Все суммы vault учитываются в целых миллионных долях USDT. Размещение разрешено только из свободного обеспечения. Оно не меняет общий капитал и не забирает резерв уже согласованных сделок. `acceptQuote` повторно проверяет доступный лимит с учётом vault. Завершение сделки освобождает только её резерв; капитал в vault остаётся заблокированным.

Включение опции само по себе не переводит средства. Перед каждым размещением интерфейс показывает сумму и лимит сделок до/после. Отключение запрещает новые размещения, сохраняя существующие позиции и запросы на вывод.

Состояния позиции:

1. `active`: сумма исключена из свободного обеспечения.
2. `withdrawal-pending`: запрос создан, сумма всё ещё исключена.
3. `withdrawn`: отдельное подтверждение демо-возврата освобождает сумму один раз; запись остаётся в истории.

Автоматических таймеров вывода и дохода нет. Кнопка подтверждения возврата — явная имитация события в браузере. В реальной интеграции её должен заменить проверенный статус протокола/кастодиана.

## API и сохранение

`vault.js` не импортирует domain и не обращается к сети. Он экспортирует:

- `migrateVault(state)`: добавляет пустой vault только при его отсутствии; существующие позиции и блокировки сохраняются.
- `vaultMetrics(state)`: `activeUSDT`, `withdrawalPendingUSDT`, `depositedUSDT` (active + pending), `withdrawnUSDT`, `collateralTotalUSDT`, `tradeReservedUSDT`, `availableUSDT`, `invalidState`.
- `setVaultEnabled(state, boolean)`.
- `depositVault(state, amount, now?)`.
- `requestVaultWithdrawal(state, depositId, now?)`.
- `confirmVaultWithdrawal(state, depositId, now?)`.

`state.vault = { version: 1, enabled, deposits }`. Позиция содержит `id`, `amountUSDT`, `status`, `createdAt`, при выводе — `withdrawalRequestedAt` и `withdrawnAt`. При повреждённых данных новые размещения и новый резерв сделок блокируются; миграция не стирает позиции, чтобы случайно не освободить обеспечение.

`domain.migrateState` вызывает миграцию vault после восстановления резервов сделок. Версия общего состояния остаётся 2. `providerMetrics` включает `collateralVaultLockedUSDT`, а `collateralAvailableUSDT` уже исключает vault.

`vault-ui.js` экспортирует `vaultPage(state, helpers)`, `vaultSummaryCard(state, helpers)` и `vaultModal(state, {mode, depositId?, amount?}, helpers)`. Helpers: `icon`, `esc`, `fmt`, `language`. Модалка возвращает `{title, subtitle, body}` для общей оболочки. Все изменения выполняются обработчиками приложения только после review.

Форма размещения: `#vault-deposit-form`, поле `#vault-amount`. Сумма после локального разбора сохраняется как draft до нажатия `vault-deposit-confirm`; при подтверждении модель заново проверяет доступный баланс.

Действия: `vault-open`, `vault-enable-review`, `vault-disable-review`, `vault-withdraw-review`, `vault-confirm-withdrawal-review`; подтверждения: `vault-enable-confirm`, `vault-disable-confirm`, `vault-deposit-confirm`, `vault-withdraw-confirm`, `vault-confirm-withdrawal`. Действия позиции передают `data-id`.
