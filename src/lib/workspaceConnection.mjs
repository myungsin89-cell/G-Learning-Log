// Opening an assignment and pressing a control during setup share one request.
// In particular, they must not create two private stores for a new assignment.
export class WorkspaceConnection {
  pending = null;
  connect(authorize, options = {}) {
    if (this.pending) return this.pending;
    const pending = (async () => {
      const api = await authorize(options);
      const result = await api.initialize();
      return { api, result };
    })();
    this.pending = pending;
    const clear = () => { if (this.pending === pending) this.pending = null; };
    pending.then(clear, clear);
    return pending;
  }
}
