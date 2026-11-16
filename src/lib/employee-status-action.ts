/** Request a workflow, never change the employee's saved status at the switch. */
export async function requestEmployeeStatusAction({ active, confirmOffboarding, startOffboarding, reactivate }: {
  active: boolean;
  confirmOffboarding: () => Promise<boolean>;
  startOffboarding: () => void;
  reactivate: () => void;
}) {
  if (!active) {
    reactivate();
    return;
  }
  if (await confirmOffboarding()) startOffboarding();
}