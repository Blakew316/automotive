"""Shared helpers for turning the NHTSA vPIC database into the site's offline data files.

Pattern keys describe VIN positions 4-8 (before '|') and 10-17 (after '|'), using '*' as a
wildcard and [..] character classes (with ranges such as [A-D]).
"""
import re

VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'


def parse_tokens(part):
    """'ZE4F[1579]' -> [{'Z'}, {'E'}, {'4'}, {'F'}, {'1','5','7','9'}]; '*' -> None."""
    out, i = [], 0
    while i < len(part):
        ch = part[i]
        if ch == '[':
            j = part.index(']', i)
            body, chars, k = part[i + 1:j], set(), 0
            while k < len(body):
                if k + 2 < len(body) and body[k + 1] == '-':
                    lo, hi = body[k], body[k + 2]
                    chars.update(c for c in VIN_CHARS if lo <= c <= hi)
                    k += 3
                else:
                    chars.add(body[k])
                    k += 1
            out.append(frozenset(chars))
            i = j + 1
        elif ch == '*':
            out.append(None)
            i += 1
        else:
            out.append(frozenset(ch))
            i += 1
    return out


def parse_key(key):
    vds, _, vis = key.partition('|')
    return parse_tokens(vds), parse_tokens(vis) if vis else []


def specificity(tokens):
    s = 0.0
    for t in tokens:
        if t is None:
            continue
        s += 1.0 if len(t) == 1 else max(0.05, 1 - (len(t) - 1) / len(VIN_CHARS))
    return s


def tokens_match(tokens, text):
    if len(text) < len(tokens):
        # Text shorter than pattern: only matches if the overflow is all wildcards.
        if any(t is not None for t in tokens[len(text):]):
            return False
    for t, ch in zip(tokens, text):
        if t is not None and ch not in t:
            return False
    return True


def render_tokens(sets):
    """Per-position char sets -> compact pattern string like 'CV1F[345]'."""
    out = []
    for s in sets:
        if s is None or len(s) >= len(VIN_CHARS):
            out.append('*')
        elif len(s) == 1:
            out.append(next(iter(s)))
        else:
            out.append('[' + ''.join(sorted(s, key=VIN_CHARS.index)) + ']')
    return ''.join(out)


def enumerate_leaves(model_vds, patterns, width=5):
    """Split the descriptor space allowed by a Model pattern into classes that match exactly the
    same set of (VDS-only) patterns. Yields (per-position char sets, matching pattern indexes).

    `patterns` is a list of token lists (VDS part). Patterns shorter than `width` are padded
    with wildcards. Only classes reachable under the model pattern are produced, so the number
    of leaves equals the number of genuinely distinct decode outcomes for that model.
    """
    padded = [p + [None] * (width - len(p)) for p in patterns]
    model = model_vds + [None] * (width - len(model_vds))

    def alive_for(idx):
        out = []
        for i in idx:
            ok = True
            for pos in range(width):
                a, b = padded[i][pos], model[pos]
                if a is not None and b is not None and not (a & b):
                    ok = False
                    break
            if ok:
                out.append(i)
        return out

    start = alive_for(range(len(padded)))

    def rec(pos, alive, prefix):
        if pos == width:
            yield prefix, alive
            return
        allowed = model[pos] if model[pos] is not None else frozenset(VIN_CHARS)
        groups = {}
        for ch in allowed:
            sig = tuple(i for i in alive if padded[i][pos] is None or ch in padded[i][pos])
            groups.setdefault(sig, set()).add(ch)
        for sig, chars in groups.items():
            yield from rec(pos + 1, list(sig), prefix + [frozenset(chars)])

    yield from rec(0, start, [])
