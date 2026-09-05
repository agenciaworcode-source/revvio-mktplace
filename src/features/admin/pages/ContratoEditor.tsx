import { ContractEditorPage } from "@/features/contracts/ContractEditorPage";
import { useAdminContractScope, useAdminAutofill } from "../contractScope";

export function ContratoEditor() {
  return (
    <ContractEditorPage scope={useAdminContractScope()} autofill={useAdminAutofill()} />
  );
}
