import SwiftUI
import SwiftData

struct DashboardView: View {
    @Binding var selectedSection: DashboardSection
    @ObservedObject var state = AppState.shared
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selectedSection) {
                Section("Main") {
                    NavigationLink(value: DashboardSection.home) {
                        Label("Home", systemImage: "house")
                    }
                    NavigationLink(value: DashboardSection.dictionary) {
                        Label("Dictionary", systemImage: "book")
                    }
                }
                
                Section("Tools") {
                    NavigationLink(value: DashboardSection.replaceText) {
                        Label("Replace Text", systemImage: "arrow.left.arrow.right")
                    }
                    NavigationLink(value: DashboardSection.history) {
                        Label("History", systemImage: "clock")
                    }
                }
                
                Section("Support") {
                    NavigationLink(value: DashboardSection.settings) {
                        Label("Settings", systemImage: "gear")
                    }
                }
            }
            .listStyle(SidebarListStyle())
            .frame(minWidth: 200)
        } detail: {
            detailView
                .toolbar {
                    ToolbarItem(placement: .navigation) {
                        Text("Eloquent Dashboard")
                            .font(.title3)
                    }
                }
        }
    }
    
    @ViewBuilder
    private var detailView: some View {
        switch selectedSection {
        case .home:
            HomeView()
        case .history:
            HistoryView()
        case .dictionary:
            DictionaryView()
        case .replaceText:
            ReplaceTextView()
        case .settings:
            SettingsView()
        }
    }
}

struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView(selectedSection: .constant(.home))
            .frame(width: 900, height: 600)
    }
}