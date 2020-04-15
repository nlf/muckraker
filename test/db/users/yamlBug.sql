SELECT
  json_array_elements(json_extract_path(users.values::json, 'one', 'two')) -> 'banana' #>> '{}' as banana,
  count(*)
FROM users
