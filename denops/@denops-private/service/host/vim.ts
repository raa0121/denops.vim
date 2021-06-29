import { VimMessage, VimSession, Cache } from "../deps.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

const cache = new Cache<string, boolean>(1000);

export class Vim implements Host {
  #session: VimSession;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new VimSession(reader, writer);
  }

  private async isTest(): Promise<boolean> {
    if (!cache.has("isTest")) {
      const isTest = await this.#session.expr("g:denops#test") as number
      cache.set("isTest", isTest !== 0);
    }
    return cache.get("isTest");
  }

  private async isDebug(): Promise<boolean> {
    if (!cache.has("isDebug")) {
      const isDebug = await this.#session.expr("g:denops#debug") as number
      cache.set("isDebug", isDebug !== 0);
    }
    return cache.get("isDebug");
  }

  private async wrapCall(fn: string, ...args: unknown[]): Promise<unknown> {
    await this.#session.call("denops#api#context", 'denops_vim_call', {
      fn,
      args,
    });
    await this.#session.ex(`let v:errmsg = ''`);
    await this.#session.ex(`let g:denops_vim_call.ret = call(g:denops_vim_call.fn, g:denops_vim_call.args)`);
    const [ret, err] = await this.#session.expr('[g:denops_vim_call.ret, v:errmsg]') as [unknown, string];
    if (err !== "") {
      throw new Error(err);
    }
    return ret;
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    try {
      if (await this.isDebug() || await this.isTest()) {
        return await this.wrapCall(fn, ...args);
      } else {
        return await this.#session.call(fn, ...args);
      }
    } finally {
      // Make sure that everything is up to date after the command
      await this.#session.redraw();
    }
  }

  register(invoker: Invoker): void {
    this.#session.replaceCallback(async (message: VimMessage) => {
      const [msgid, expr] = message;
      let ok = null;
      let err = null;
      try {
        ok = await dispatch(invoker, expr);
      } catch (e) {
        err = e;
      }
      if (msgid !== 0) {
        await this.#session.reply(msgid, [ok, err]);
      } else if (err !== null) {
        console.error(err);
      }
    });
  }

  waitClosed(): Promise<void> {
    return this.#session.waitClosed();
  }

  dispose(): void {
    this.#session.dispose();
  }
}

async function dispatch(invoker: Invoker, expr: unknown): Promise<unknown> {
  if (isInvokeMessage(expr)) {
    const [_, method, args] = expr;
    if (!isInvokerMethod(method)) {
      throw new Error(`Method '${method}' is not defined in the invoker`);
    }
    // deno-lint-ignore no-explicit-any
    return await (invoker[method] as any)(...args);
  } else {
    throw new Error(
      `Unexpected JSON channel message is received: ${JSON.stringify(expr)}`,
    );
  }
}

type InvokeMessage = ["invoke", string, unknown[]];

function isInvokeMessage(data: unknown): data is InvokeMessage {
  return (
    Array.isArray(data) &&
    data.length === 3 &&
    data[0] === "invoke" &&
    typeof data[1] === "string" &&
    Array.isArray(data[2])
  );
}
