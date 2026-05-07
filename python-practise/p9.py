# Input: pairs = [(1, 2), (3, 4), (5, 6)]
# Output: [2, 12, 30]

input = [(1, 2), (3, 4), (5, 6)]

result = [a * b for a, b in input]

print(result)
