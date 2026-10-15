// files.get only includes permissions when the caller can share the file.
// Ask the permissions endpoint before treating an omitted list as unknown.
export async function filePermissions(file, listPermissions) {
  if (Array.isArray(file.permissions) && file.permissions.length) return file.permissions;
  const result = await listPermissions();
  return Array.isArray(result.permissions) ? result.permissions : [];
}
