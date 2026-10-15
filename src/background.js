import {resolveListing,validateBasket} from './core.js';
let catalogPromise;
let queue = Promise.resolve();
const catalog = () => catalogPromise ||= fetch(chrome.runtime.getURL('catalog.json')).then(r => r.json());
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  if (!sender.url?.startsWith('https://steamcommunity.com/market/')) return;
  queue = queue.catch(()=>{}).then(async () => {
    const data = await catalog();
    const stored = await chrome.storage.local.get('basket');
    const items = stored.basket || [];
    // Clear remains available to recover from a stale catalog or corrupt state.
    if (message.type === 'clear') {await chrome.storage.local.set({basket:[]}); return [];}
    if (message.type === 'remove') {
      const next = items.filter(i => i.listingId !== message.listingId);
      await chrome.storage.local.set({basket:next}); return next;
    }
    validateBasket(items,data);
    if (message.type === 'get') return items;
    if (message.type !== 'add') throw new Error('Unknown request.');
    const next = [...items,resolveListing(message.record,data)];
    validateBasket(next,data);
    await chrome.storage.local.set({basket:next});
    return next;
  });
  queue.then(basket => respond({basket}), e => respond({error:e.message}));
  return true;
});
