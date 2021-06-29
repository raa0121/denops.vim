import { VimMessage, VimSession } from "../deps.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

export class Vim implements Host {
  #session: VimSession;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new VimSession(reader, writer);
  }

  private async wrapCall(fn: string, ...args: unknown[]): Promise<unknown> {
    // NOTE: https://github.com/vim/vim/pull/8477
    const [ret, err] = await this.#session.call('denops#api#call', fn, args) as [unknown, string];
    if (err !== "") {
      throw new Error(err);
    }
    return ret;
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    try {
      return await this.wrapCall(fn, ...args);
    } finally {
      // Make sure that everything is up to date after the command
      await this.#session.redraw();
    }
  }

  async batch(...calls: [string, ...unknown[]][]): Promise<[unknown[], string]> {
    const results = [];
    for (const [fn, ...args] of calls) {
      try {
        results.push(await this.wrapCall(fn, ...args));
      } catch (e) {
        // Make sure that everything is up to date after the command
        await this.#session.redraw();
        return [results, e.toString()];
      }
    }
    // Make sure that everything is up to date after the command
    await this.#session.redraw();
    return [results, ''];
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
