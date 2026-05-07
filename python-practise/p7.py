def get_larger_than_3(n) :
  if n > 3 :
    return n

nums = [1, 2, 3, 4, 5, 6]

result = [get_larger_than_3(n) for n in nums]

print(result)