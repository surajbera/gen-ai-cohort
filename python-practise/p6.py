def get_even(n):
  return n % 2 == 0

nums = [1, 2, 3, 4, 5]

result = [get_even(n) for n in nums]

print(result)