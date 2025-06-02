
export class DashaMailException extends Error {
    response?: unknown;
    code?: number;
    constructor(message: string, response?: unknown = undefined, code?: number) {
        super(message);
        this.name = 'DashaMailException';
        this.response = response;
        this.code = code;
    }
}

export interface ClientOptions {
    apiKey: string;
    format?: 'json' | 'xml';
    timeout?: number; // ms
}

export class Client {
    static BASE_URL = 'https://api.dashamail.ru/';
    static DEFAULT_TIMEOUT = 10000;

    private apiKey: string;
    private format: 'json' | 'xml';
    private timeout: number;

    constructor({ apiKey, format = 'json', timeout = Client.DEFAULT_TIMEOUT }: ClientOptions) {
        this.apiKey = apiKey;
        this.format = format;
        this.timeout = timeout;

        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === 'string' && !(prop in target)) {
                    return async (params: Record<string, unknown> = {}): Promise<any> =>
                        await target._callApi(prop, params);
                }
                // @ts-ignore
                return target[prop];
            },
        });
    }

    private _camelToDashamail(name: string): string {
        return name.replace(/([a-z])([A-Z])/g, '$1.$2').toLowerCase();
    }

    private async _callApi(methodCamelCase: string, params: Record<string, unknown> = {}): Promise<any> {
        const method = this._camelToDashamail(methodCamelCase);
        const url = Client.BASE_URL;
        const payload: Record<string, unknown> = {
            api_key: this.apiKey,
            method,
            format: this.format,
            ...params
        };

        let controller: AbortController | undefined;
        let signal: AbortSignal | undefined;
        if (typeof AbortController !== "undefined") {
            controller = new AbortController();
            signal = controller.signal;
            setTimeout(() => controller!.abort(), this.timeout);
        }

        let res: Response;
        try {
            res = await fetch(url, {
                method: 'POST',
                body: new URLSearchParams(payload as Record<string, string>),
                signal,
            });
        } catch (err) {
            throw new DashaMailException(`Network error: ${err}`);
        }

        let json: any;
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
