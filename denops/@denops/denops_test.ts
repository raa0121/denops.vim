import { assertMatch, assertEquals, assertThrowsAsync } from "./deps_test.ts";
import { test } from "./test/tester.ts";

test({
  mode: "all",
  name: "denops.call() calls a Vim/Neovim function and return a result",
  fn: async (denops) => {
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
  },
});

test({
  mode: "all",
  name: "denops.call() calls a Vim/Neovim function and throw an error",
  fn: async (denops) => {
    await assertThrowsAsync(async () => {
      console.log(await denops.call("no-such-function"));
    }, undefined, "E117: Unknown function: no-such-function");
  },
});

test({
  mode: "all",
  name: "denops.cmd() invoke a Vim/Neovim command",
  fn: async (denops) => {
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});

test({
  mode: "all",
  name: "denops.eval() evaluate a Vim/Neovim expression and return a result",
  fn: async (denops) => {
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});

test({
  mode: "all",
  name: "denops.batch() calls multiple Vim/Neovim functions and return results",
  fn: async (denops) => {
    const [rs, emsg] = await denops.batch(["range", 1], ["range", 2], ["range", 3]);
    assertEquals(rs, [[0], [0,1], [0,1,2]]);
    assertEquals(emsg, "");
  },
});

test({
  mode: "all",
  name: "denops.batch() calls multiple Vim/Neovim functions and return results and error",
  fn: async (denops) => {
    const [rs, emsg] = await denops.batch(["range", 1], ["no-such-function", 2], ["range", 3]);
    assertEquals(rs, [[0]]);
    assertMatch(emsg, /E117: Unknown function: no-such-function/);
  },
});
