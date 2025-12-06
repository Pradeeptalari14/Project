-- Insert the default Admin user into the 'users' table
-- Password matches '123' (stored as plaintext in this demo app)

INSERT INTO public.users (id, data)
VALUES (
  '1',
  '{
    "id": "1",
    "username": "admin",
    "password": "123",
    "role": "ADMIN",
    "fullName": "System Administrator",
    "empCode": "ADM001",
    "isApproved": true,
    "email": "admin@unicharm.com"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
