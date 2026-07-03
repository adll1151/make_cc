using Xunit;

// Theme.Current 등 전역 static 상태를 공유하는 테스트가 있어 클래스 간 병렬 실행 시
// 레이스가 발생한다(예: FeatureTests의 Theme.Apply가 ThemeTests 검증에 끼어듦).
// 스위트가 작고 빠르므로(≈45개·<1s) 병렬화를 끄고 순차 실행해 격리를 보장한다.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
