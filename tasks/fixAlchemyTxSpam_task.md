Создать задачу Codex для подключения скрипта фикса спама от Alchemy:

```javascript
 task("run:fixAlchemyTxSpam")
   .description("Подключение к Alchemy через WebSocket и фильтрация валидных транзакций")
   .setScript("tasks/fixAlchemyTxSpam.js")
```
