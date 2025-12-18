import SwiftUI

struct WaveformView: View {
    @Binding var amplitudes: [Float]
    
    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<amplitudes.count, id: \.self) { index in
                WaveformBar(height: CGFloat(amplitudes[index]) * 40, isActive: amplitudes[index] > 0.01)
            }
        }
        .frame(height: 40)
        .drawingGroup() // Rasterize for better performance
    }
}

struct WaveformBar: View {
    let height: CGFloat
    let isActive: Bool
    @State private var animatedHeight: CGFloat = 0
    
    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(LinearGradient(
                gradient: Gradient(colors: [Constants.brandBlue, Constants.brandDarkBlue]),
                startPoint: .bottom,
                endPoint: .top
            ))
            .frame(width: 4, height: max(4, min(height + 4, 40)))
            .scaleEffect(y: isActive ? 1.0 : 0.3, anchor: .bottom)
            .animation(.easeInOut(duration: 0.05), value: height)
            .opacity(isActive ? 1.0 : 0.5)
    }
}

struct WaveformView_Previews: PreviewProvider {
    static var previews: some View {
        WaveformView(amplitudes: .constant(Array(repeating: 0.3, count: 40)))
            .frame(width: 300, height: 50)
            .padding()
    }
}