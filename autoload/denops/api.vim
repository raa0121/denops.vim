function! denops#api#cmd(cmd, context) abort
  call extend(l:, a:context)
  call execute(a:cmd, '')
endfunction

function! denops#api#eval(expr, context) abort
  call extend(l:, a:context)
  return eval(a:expr)
endfunction

function! denops#api#context(name, context) abort
  let g:{a:name} = a:context
endfunction
