function! denops#api#cmd(cmd, context) abort
  call extend(l:, a:context)
  call execute(a:cmd, '')
endfunction

function! denops#api#eval(expr, context) abort
  call extend(l:, a:context)
  return eval(a:expr)
endfunction

" NOTE: https://github.com/vim/vim/pull/8477
function! denops#api#call(fn, args) abort
  try
    return [call(a:fn, a:args), '']
  catch
    return [v:null, v:exception]
  endtry
endfunction
