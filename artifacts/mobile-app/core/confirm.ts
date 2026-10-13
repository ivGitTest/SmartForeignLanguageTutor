export async function confirm(title: string, message: string) {
  return window.confirm(`${title}\n\n${message}`);
}
