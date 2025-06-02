
class DashaMailException extends Error {
    constructor(message, response = null, code = 0) {
        super(message);
        this.name = 'DashaMailException';
        this.response = response;
        this.code = code;
    }
}

class Client {
    static BASE_URL = 'https://api.dashamail.ru/';
    static TIMEOUT = 10000; // ms

    constructor({ apiKey, format = 'json', timeout = Client.TIMEOUT }) {
        this.apiKey = apiKey;
        this.format = format;
        this.timeout = timeout;

        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === 'string' && !(prop in target)) {
                    // Универсальный вызов: client.listGet({ ... })
                    return async (params = {}) => await target._callApi(prop, params);
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }

    _camelToDashamail(name) {
        // listGet → list.get, messageSend → message.send
        return name.replace(/([a-z])([A-Z])/g, '$1.$2').toLowerCase();
    }

    async _callApi(methodCamelCase, params = {}) {
        const method = this._camelToDashamail(methodCamelCase);

        const body = new URLSearchParams({
            api_key: this.apiKey,
            method,
            format: this.format,
            ...params
        });

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);

        let res, json;
        try {
            res = await fetch(Client.BASE_URL, {
                method: 'POST',
                body,
                signal: controller.signal
            });
            clearTimeout(id);
        } catch (err) {
            throw new DashaMailException(`Network error: ${err}`);
        }

        try {
            json = await res.json();
        } catch (err) {
            throw new DashaMailException(`JSON decode error: ${err}`, null, res.status);
        }

        const code = Number(json.code ?? res.status);
        const message = json.message ?? 'Unknown error';

        if (code !== 0) {
            throw new DashaMailException(message, json, code);
        }

        return json.data ?? null;
    }
}

export { Client, DashaMailException };
