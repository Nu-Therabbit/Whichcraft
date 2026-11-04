use crate::{
    error::WhichcraftError,
    whichcraft::{compose::configuration_app, domain::configuration::*},
};
async fn background<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, WhichcraftError> + Send + 'static,
) -> Result<T, WhichcraftError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| WhichcraftError::InvalidInput("Configuration task failed".into()))?
}
#[tauri::command]
pub async fn configuration_inspect(
    context: ConfigurationContext,
) -> Result<ConfigurationInspection, WhichcraftError> {
    background(move || configuration_app().inspect(&context)).await
}
#[tauri::command]
pub async fn configuration_plan(
    request: ConfigurationPlanRequest,
) -> Result<ConfigurationPlan, WhichcraftError> {
    background(move || configuration_app().plan(&request)).await
}
#[tauri::command]
pub async fn configuration_apply(id: String) -> Result<ConfigurationWriteResult, WhichcraftError> {
    background(move || configuration_app().apply(&id)).await
}
#[tauri::command]
pub async fn configuration_undo(id: String) -> Result<ConfigurationWriteResult, WhichcraftError> {
    background(move || configuration_app().undo(&id)).await
}
#[tauri::command]
pub async fn configuration_operation() -> Result<Option<ConfigurationOperationView>, WhichcraftError>
{
    background(move || configuration_app().operation()).await
}
#[tauri::command]
pub async fn configuration_acknowledge(id: String) -> Result<(), WhichcraftError> {
    background(move || configuration_app().acknowledge_recovery(&id)).await
}
#[tauri::command]
pub async fn configuration_forget_repository(path: String) -> Result<(), WhichcraftError> {
    background(move || configuration_app().forget_repository(&path)).await
}
