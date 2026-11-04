#[cfg(test)]
mod audit_tests {
 use super::*;
 #[tokio::test]
 async fn same_second_backups_replace_the_previous_backup() {
  for _ in 0..10 {
   let temp=tempfile::tempdir().unwrap();
   let first=create_backup_with_limit_impl("Host first\n",10,Some(temp.path())).await.unwrap();
   let second=create_backup_with_limit_impl("Host second\n",10,Some(temp.path())).await.unwrap();
   if first.file_path==second.file_path {
    assert_ne!(first.config_hash,second.config_hash);
    assert_eq!(std::fs::read_to_string(&first.file_path).unwrap(),"Host second\n");
    assert_eq!(list_backups_impl(Some(temp.path())).await.unwrap().len(),1);
    return;
   }
  }
  panic!("did not obtain a same-second pair; inconclusive");
 }
}